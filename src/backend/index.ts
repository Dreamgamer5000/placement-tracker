import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import db from './db/index.js';

const app = new Hono();

app.use('/*', cors());

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok' });
});

// Get paginated and searchable students list
app.get('/api/students', (c) => {
  const search = c.req.query('search')?.trim() || '';
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50')));
  const sortByShortlists = c.req.query('sortByShortlists') === 'true' || c.req.query('sort') === 'shortlists';
  const unmappedChennai = c.req.query('unmappedChennai') === 'true';
  const mastersFilter = c.req.query('masters') === 'true';

  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (unmappedChennai) {
    conditions.push(`(s.campus = 'Chennai' OR s.campus LIKE '%Chennai%') AND (s.neo_id IS NULL OR s.neo_id = '' OR s.neo_id = 'Unknown')`);
  }

  if (mastersFilter) {
    conditions.push(`s.masters = 1`);
  }

  if (search) {
    conditions.push(`(s.name LIKE ? OR s.regno LIKE ? OR s.neo_id LIKE ? OR s.branch LIKE ? OR s.campus LIKE ?)`);
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching
  const countSql = `SELECT COUNT(*) as count FROM students s ${whereClause}`;
  const totalRow = db.prepare(countSql).get(...params) as { count: number } | undefined;
  const totalCount = totalRow ? totalRow.count : 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Global count of unmapped Chennai students
  const unmappedChennaiRow = db.prepare(
    `SELECT COUNT(*) as count FROM students WHERE (campus = 'Chennai' OR campus LIKE '%Chennai%') AND (neo_id IS NULL OR neo_id = '' OR neo_id = 'Unknown')`
  ).get() as { count: number } | undefined;
  const unmappedChennaiCount = unmappedChennaiRow ? unmappedChennaiRow.count : 0;

  // Global count of masters students
  const mastersRow = db.prepare(
    `SELECT COUNT(*) as count FROM students WHERE masters = 1`
  ).get() as { count: number } | undefined;
  const mastersCount = mastersRow ? mastersRow.count : 0;

  let orderClause = 'ORDER BY s.name ASC';
  if (sortByShortlists) {
    orderClause = 'ORDER BY shortlist_count DESC, s.name ASC';
  }

  const dataSql = `
    SELECT 
      s.*,
      (SELECT COUNT(*) FROM shortlists WHERE student_id = s.id) as shortlist_count
    FROM students s
    ${whereClause}
    ${orderClause}
    LIMIT ? OFFSET ?
  `;

  const students = db.prepare(dataSql).all(...params, limit, offset);

  return c.json({
    students,
    totalCount,
    unmappedChennaiCount,
    mastersCount,
    page,
    limit,
    totalPages
  });
});

// Get students sorted by shortlist count (must be BEFORE :id route)
app.get('/api/students/by-shortlists', (c) => {
  const students = db.prepare(`
    SELECT s.*, COUNT(sl.id) as shortlist_count
    FROM students s
    LEFT JOIN shortlists sl ON s.id = sl.student_id
    GROUP BY s.id
    ORDER BY shortlist_count DESC, s.name ASC
    LIMIT 50
  `).all();
  
  return c.json({
    students,
    totalCount: students.length,
    page: 1,
    limit: 50,
    totalPages: 1
  });
});

// Get student by ID
app.get('/api/students/:id', (c) => {
  const id = c.req.param('id');
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  
  if (!student) {
    return c.json({ error: 'Student not found' }, 404);
  }
  
  // Get shortlisted companies
  const shortlists = db.prepare(`
    SELECT c.*, s.shortlisted_at, s.round_number, s.round_name
    FROM companies c
    JOIN shortlists s ON c.id = s.company_id
    WHERE s.student_id = ?
    ORDER BY s.round_number ASC, s.shortlisted_at DESC
  `).all(id);
  
  // Get selected companies
  const selections = db.prepare(`
    SELECT c.*, sel.selected_at 
    FROM companies c
    JOIN selections sel ON c.id = sel.company_id
    WHERE sel.student_id = ?
    ORDER BY sel.selected_at DESC
  `).all(id);
  
  // Get final company
  let finalCompany = null;
  if ((student as any).final_company_id) {
    finalCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get((student as any).final_company_id);
  }
  
  return c.json({ ...student, shortlists, selections, finalCompany });
});

// Update student by ID
app.put('/api/students/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(id);
  if (!existing) {
    return c.json({ error: 'Student not found' }, 404);
  }

  let {
    name,
    regno,
    email,
    phone,
    personal_email,
    gender,
    cgpa,
    tenth_marks,
    twelfth_marks,
    resume_link,
    branch,
    campus,
    neo_id,
    placed,
    masters,
    status,
    topcoder
  } = body;

  if (!name || !regno || !email) {
    return c.json({ error: 'Name, Register Number, and Email are required' }, 400);
  }

  // Derive status enum string if not passed
  if (!status) {
    if (masters) status = 'masters';
    else if (placed) status = 'placed';
    else status = 'not_placed';
  }

  // Sync boolean flags for backward compatibility
  const isPlaced = status === 'placed' || status === 'intern';
  const isMasters = status === 'masters';
  const isTopcoder = topcoder ? 1 : 0;

  const updateStmt = db.prepare(`
    UPDATE students
    SET name = ?,
        regno = ?,
        email = ?,
        phone = ?,
        personal_email = ?,
        gender = ?,
        cgpa = ?,
        tenth_marks = ?,
        twelfth_marks = ?,
        resume_link = ?,
        branch = ?,
        campus = ?,
        neo_id = ?,
        placed = ?,
        masters = ?,
        status = ?,
        topcoder = ?
    WHERE id = ?
  `);

  updateStmt.run(
    name,
    regno,
    email,
    phone || null,
    personal_email || null,
    gender || null,
    cgpa !== undefined && cgpa !== null && cgpa !== '' ? Number(cgpa) : null,
    tenth_marks !== undefined && tenth_marks !== null && tenth_marks !== '' ? Number(tenth_marks) : null,
    twelfth_marks !== undefined && twelfth_marks !== null && twelfth_marks !== '' ? Number(twelfth_marks) : null,
    resume_link || null,
    branch || '',
    campus || '',
    neo_id ? String(neo_id).trim() : null,
    isPlaced ? 1 : 0,
    isMasters ? 1 : 0,
    status,
    isTopcoder,
    id
  );

  // If neo_id is provided, also insert/update into neo_ids table
  if (neo_id && String(neo_id).trim()) {
    const trimmedNeoId = String(neo_id).trim();
    const studentCampus = campus || 'Chennai';
    db.prepare(`
      INSERT INTO neo_ids (neo_id, campus, student_id, regno, topcoder)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(neo_id) DO UPDATE SET campus = excluded.campus, student_id = excluded.student_id, regno = excluded.regno, topcoder = excluded.topcoder
    `).run(trimmedNeoId, studentCampus, id, regno, isTopcoder);
  }

  const updatedStudent = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  return c.json(updatedStudent);
});

// Get all Neo IDs
app.get('/api/neo-ids', (c) => {
  const records = db.prepare('SELECT * FROM neo_ids ORDER BY neo_id').all();
  return c.json(records);
});

// Search students by regno
app.get('/api/students/search/:regno', (c) => {
  const regno = c.req.param('regno').toUpperCase();
  const student = db.prepare('SELECT * FROM students WHERE regno = ?').get(regno);
  
  if (!student) {
    return c.json({ error: 'Student not found' }, 404);
  }
  
  return c.json(student);
});

// Get all companies
app.get('/api/companies', (c) => {
  const companies = db.prepare('SELECT * FROM companies ORDER BY name').all();
  return c.json(companies);
});

// Get company by ID with analytics and round-by-round shortlists
app.get('/api/companies/:id', (c) => {
  const id = c.req.param('id');
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
  
  if (!company) {
    return c.json({ error: 'Company not found' }, 404);
  }
  
  // Get analytics
  const analytics = db.prepare('SELECT * FROM company_analytics WHERE company_id = ?').get(id);
  
  // Get shortlisted students
  const shortlisted = db.prepare(`
    SELECT s.*, sl.shortlisted_at, sl.round_number, sl.round_name
    FROM students s
    JOIN shortlists sl ON s.id = sl.student_id
    WHERE sl.company_id = ?
    ORDER BY sl.round_number DESC, s.cgpa DESC
  `).all(id);

  // Group shortlists by round number / round name
  const roundMap = new Map<number, { round_number: number; round_name: string; students: any[]; chennai_count: number; unknown_count: number }>();
  for (const s of shortlisted as any[]) {
    const rNum = s.round_number || 1;
    const rName = s.round_name || `Shortlist ${rNum}`;
    if (!roundMap.has(rNum)) {
      roundMap.set(rNum, { round_number: rNum, round_name: rName, students: [], chennai_count: 0, unknown_count: 0 });
    }
    const roundObj = roundMap.get(rNum)!;
    roundObj.students.push(s);
    if (s.campus === 'Unknown' || !s.campus) {
      roundObj.unknown_count++;
    } else if (s.campus === 'Chennai') {
      roundObj.chennai_count++;
    }
  }
  const shortlist_rounds = Array.from(roundMap.values()).sort((a, b) => b.round_number - a.round_number);
  
  // Get selected students
  const selected = db.prepare(`
    SELECT s.*, sel.selected_at
    FROM students s
    JOIN selections sel ON s.id = sel.student_id
    WHERE sel.company_id = ?
    ORDER BY s.cgpa DESC
  `).all(id);
  
  // Get placed students (deprecated, use selected instead)
  const placed = db.prepare(`
    SELECT * FROM students WHERE final_company_id = ?
  `).all(id);
  
  return c.json({ ...company, analytics, shortlisted, shortlist_rounds, selected, placed });
});

// Create company
app.post('/api/companies', async (c) => {
  const body = await c.req.json();
  const { name, notes, rounds, ctc, total_rounds, round_details, experience_required } = body;
  
  try {
    const result = db.prepare(
      'INSERT INTO companies (name, notes, rounds, ctc, total_rounds, round_details, experience_required) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      name,
      notes || null,
      rounds ? parseInt(rounds) : (total_rounds ? parseInt(total_rounds) : null),
      ctc || null,
      total_rounds ? parseInt(total_rounds) : (rounds ? parseInt(rounds) : null),
      round_details || null,
      experience_required || null
    );
    
    // Initialize analytics
    db.prepare(
      'INSERT INTO company_analytics (company_id) VALUES (?)'
    ).run(result.lastInsertRowid);
    
    const created = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid);
    return c.json(created);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Update company
app.put('/api/companies/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { name, notes, rounds, ctc, total_rounds, round_details, experience_required } = body;
  
  try {
    db.prepare(
      'UPDATE companies SET name = ?, notes = ?, rounds = ?, ctc = ?, total_rounds = ?, round_details = ?, experience_required = ? WHERE id = ?'
    ).run(
      name,
      notes || null,
      rounds ? parseInt(rounds) : (total_rounds ? parseInt(total_rounds) : null),
      ctc || null,
      total_rounds ? parseInt(total_rounds) : (rounds ? parseInt(rounds) : null),
      round_details || null,
      experience_required || null,
      id
    );
    
    const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    return c.json(updated);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Recalculate analytics for all companies
app.post('/api/companies/recalculate-analytics', async (c) => {
  try {
    console.log('Recalculating analytics for all companies...');
    const companies = db.prepare('SELECT id, name FROM companies').all() as Array<{ id: number; name: string }>;
    
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];
    
    for (const company of companies) {
      try {
        console.log(`Recalculating analytics for ${company.name} (ID: ${company.id})`);
        updateCompanyAnalytics(company.id);
        successCount++;
      } catch (error: any) {
        console.error(`Error recalculating analytics for ${company.name}:`, error);
        errorCount++;
        errors.push({ companyId: company.id, companyName: company.name, error: error.message });
      }
    }
    
    console.log(`Analytics recalculation complete: ${successCount} success, ${errorCount} errors`);
    return c.json({ 
      success: true, 
      message: `Recalculated analytics for ${successCount} companies`,
      successCount,
      errorCount,
      errors: errorCount > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Error in recalculate-analytics endpoint:', error);
    return c.json({ error: 'Internal server error', details: error.message }, 500);
  }
});

// Helper to resolve student by Register Number or Neo ID
function resolveStudentToken(token: string) {
  const clean = token.trim();
  if (!clean) return null;
  const upper = clean.toUpperCase();

  // 1. Direct match on students (regno or neo_id)
  let student = db.prepare('SELECT id, regno, neo_id FROM students WHERE UPPER(regno) = ? OR UPPER(neo_id) = ?').get(upper, upper) as any;
  if (student) return { student, token: upper, foundIn: 'students' };

  // 2. Lookup in neo_ids mapping table
  const neoRecord = db.prepare('SELECT * FROM neo_ids WHERE UPPER(neo_id) = ?').get(upper) as any;
  if (neoRecord) {
    if (neoRecord.student_id) {
      student = db.prepare('SELECT id, regno, neo_id FROM students WHERE id = ?').get(neoRecord.student_id) as any;
      if (student) return { student, token: upper, foundIn: 'neo_ids_student_id' };
    }
    if (neoRecord.regno) {
      student = db.prepare('SELECT id, regno, neo_id FROM students WHERE UPPER(regno) = ?').get(neoRecord.regno.toUpperCase()) as any;
      if (student) return { student, token: upper, foundIn: 'neo_ids_regno' };
    }
  }

  // 3. Not found in students. Store into neo_ids table for future mapping
  db.prepare(`
    INSERT INTO neo_ids (neo_id, campus)
    VALUES (?, 'Unknown')
    ON CONFLICT(neo_id) DO NOTHING
  `).run(upper);

  return { student: null, token: upper, trackedInNeoIds: true };
}

// Add students to company shortlist (accepts RegNo or NeoID & round info)
app.post('/api/companies/:id/shortlist', async (c) => {
  try {
    const companyId = c.req.param('id');
    const body = await c.req.json();
    const inputList = body.regnos || body.identifiers || [];
    const roundNumber = body.round_number ? parseInt(body.round_number) : 1;
    const roundName = body.round_name ? String(body.round_name).trim() : `Shortlist ${roundNumber}`;

    if (!Array.isArray(inputList)) {
      return c.json({ error: 'Input list must be an array of regnos or neo_ids' }, 400);
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const item of inputList) {
      try {
        const resolved = resolveStudentToken(String(item));
        if (!resolved) continue;

        if (!resolved.student) {
          errors.push({
            identifier: resolved.token,
            error: 'Student record not found in DB. NeoID recorded in neo_ids mapping table for future matching.'
          });
          continue;
        }

        const student = resolved.student;
        const insertResult = db.prepare(`
          INSERT OR REPLACE INTO shortlists (student_id, company_id, round_number, round_name)
          VALUES (?, ?, ?, ?)
        `).run(student.id, companyId, roundNumber, roundName);

        if (insertResult.changes > 0) {
          results.push({ identifier: resolved.token, regno: student.regno, round: roundName, success: true });
        } else {
          results.push({ identifier: resolved.token, regno: student.regno, round: roundName, success: true, note: 'Already shortlisted for this round' });
        }
      } catch (error: any) {
        errors.push({ identifier: item, error: error.message });
      }
    }

    updateCompanyAnalytics(parseInt(companyId));
    return c.json({ results, errors, round_number: roundNumber, round_name: roundName });
  } catch (error: any) {
    console.error('Error in shortlist endpoint:', error);
    return c.json({ error: 'Internal server error', details: error.message }, 500);
  }
});

// Update shortlist round name for a company
app.put('/api/companies/:id/shortlist-round/:roundNumber', async (c) => {
  try {
    const companyId = c.req.param('id');
    const roundNumber = parseInt(c.req.param('roundNumber'));
    const body = await c.req.json();
    const roundName = body.round_name ? String(body.round_name).trim() : '';

    if (!roundName) {
      return c.json({ error: 'Custom shortlist round name is required' }, 400);
    }

    const result = db.prepare(`
      UPDATE shortlists
      SET round_name = ?
      WHERE company_id = ? AND round_number = ?
    `).run(roundName, companyId, roundNumber);

    return c.json({ success: true, updatedCount: result.changes, round_number: roundNumber, round_name: roundName });
  } catch (error: any) {
    console.error('Error renaming shortlist round:', error);
    return c.json({ error: 'Internal server error', details: error.message }, 500);
  }
});

// Add students to company selections (final selection, accepts RegNo or NeoID)
app.post('/api/companies/:id/selections', async (c) => {
  try {
    const companyId = c.req.param('id');
    const body = await c.req.json();
    const inputList = body.regnos || body.identifiers || [];
    const selectionStatus = body.status === 'intern' ? 'intern' : 'placed';

    if (!Array.isArray(inputList)) {
      return c.json({ error: 'Input list must be an array of regnos or neo_ids' }, 400);
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const item of inputList) {
      try {
        const resolved = resolveStudentToken(String(item));
        if (!resolved) continue;

        if (!resolved.student) {
          errors.push({
            identifier: resolved.token,
            error: 'Student record not found in DB. NeoID recorded in neo_ids mapping table for future matching.'
          });
          continue;
        }

        const student = resolved.student;
        const insertResult = db.prepare(
          'INSERT OR IGNORE INTO selections (student_id, company_id) VALUES (?, ?)'
        ).run(student.id, companyId);

        // Mark student as placed with status ('placed' or 'intern')
        db.prepare(
          'UPDATE students SET placed = 1, status = ?, final_company_id = ? WHERE id = ?'
        ).run(selectionStatus, companyId, student.id);

        if (insertResult.changes > 0) {
          results.push({ identifier: resolved.token, regno: student.regno, success: true });
        } else {
          results.push({ identifier: resolved.token, regno: student.regno, success: true, note: 'Already selected' });
        }
      } catch (error: any) {
        errors.push({ identifier: item, error: error.message });
      }
    }

    updateCompanyAnalytics(parseInt(companyId));
    return c.json({ results, errors, status: selectionStatus });
  } catch (error: any) {
    console.error('Error in selections endpoint:', error);
    return c.json({ error: 'Internal server error', details: error.message }, 500);
  }
});

// Mark student as placed
app.post('/api/students/:id/place', async (c) => {
  const studentId = c.req.param('id');
  const body = await c.req.json();
  const { companyId } = body;
  
  try {
    db.prepare(
      'UPDATE students SET placed = 1, final_company_id = ? WHERE id = ?'
    ).run(companyId, studentId);
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Get eligible companies for a student based on criteria
app.post('/api/predict-companies', async (c) => {
  const body = await c.req.json();
  const { cgpa, tenth, twelfth } = body;
  
  const eligibleCompanies = db.prepare(`
    SELECT c.*, ca.*
    FROM companies c
    LEFT JOIN company_analytics ca ON c.id = ca.company_id
    WHERE (ca.min_cgpa_shortlist IS NULL OR ca.min_cgpa_shortlist <= ?)
      AND (ca.min_tenth_shortlist IS NULL OR ca.min_tenth_shortlist <= ?)
      AND (ca.min_twelfth_shortlist IS NULL OR ca.min_twelfth_shortlist <= ?)
    ORDER BY ca.min_cgpa_shortlist DESC, ca.min_tenth_shortlist DESC, ca.min_twelfth_shortlist DESC
  `).all(cgpa, tenth, twelfth);
  
  return c.json(eligibleCompanies);
});

// Get analytics summary
app.get('/api/analytics/summary', (c) => {
  const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students').get() as any;
  const internedStudents = db.prepare(`
    SELECT COUNT(*) as count FROM students WHERE placed = 1 OR status IN ('placed', 'intern')
  `).get() as any;
  const totalCompanies = db.prepare('SELECT COUNT(*) as count FROM companies').get() as any;
  
  const branchStats = db.prepare(`
    SELECT branch, COUNT(*) as total, SUM(CASE WHEN placed = 1 OR status IN ('placed', 'intern') THEN 1 ELSE 0 END) as placed
    FROM students
    GROUP BY branch
  `).all();
  
  const campusStats = db.prepare(`
    SELECT campus, COUNT(*) as total, SUM(CASE WHEN placed = 1 OR status IN ('placed', 'intern') THEN 1 ELSE 0 END) as placed
    FROM students
    GROUP BY campus
  `).all();
  
  const topCompanies = db.prepare(`
    SELECT c.name, COUNT(s.id) as placed_count
    FROM companies c
    LEFT JOIN students s ON c.id = s.final_company_id
    GROUP BY c.id
    ORDER BY placed_count DESC
    LIMIT 10
  `).all();
  
  return c.json({
    totalStudents: totalStudents.count,
    placedStudents: internedStudents.count,
    totalCompanies: totalCompanies.count,
    placementRate: ((internedStudents.count / totalStudents.count) * 100).toFixed(2),
    branchStats,
    campusStats,
    topCompanies
  });
});

function updateCompanyAnalytics(companyId: number) {
  // Get shortlist statistics
  const shortlistStats = db.prepare(`
    SELECT 
      MIN(s.cgpa) as min_cgpa,
      AVG(s.cgpa) as avg_cgpa,
      MIN(s.tenth_marks) as min_tenth,
      AVG(s.tenth_marks) as avg_tenth,
      MIN(s.twelfth_marks) as min_twelfth,
      AVG(s.twelfth_marks) as avg_twelfth,
      COUNT(*) as total_shortlisted,
      SUM(CASE WHEN s.gender = 'Male' THEN 1 ELSE 0 END) as male_count,
      SUM(CASE WHEN s.gender = 'Female' THEN 1 ELSE 0 END) as female_count
    FROM students s
    JOIN shortlists sl ON s.id = sl.student_id
    WHERE sl.company_id = ?
  `).get(companyId) as any;
  
  // Get selection statistics
  const selectionStats = db.prepare(`
    SELECT 
      MIN(s.cgpa) as min_cgpa,
      AVG(s.cgpa) as avg_cgpa,
      MIN(s.tenth_marks) as min_tenth,
      AVG(s.tenth_marks) as avg_tenth,
      MIN(s.twelfth_marks) as min_twelfth,
      AVG(s.twelfth_marks) as avg_twelfth,
      COUNT(*) as total_selected,
      SUM(CASE WHEN s.gender = 'Male' THEN 1 ELSE 0 END) as male_count,
      SUM(CASE WHEN s.gender = 'Female' THEN 1 ELSE 0 END) as female_count
    FROM students s
    JOIN selections sel ON s.id = sel.student_id
    WHERE sel.company_id = ?
  `).get(companyId) as any;
  
  const totalShortlisted = shortlistStats?.total_shortlisted || 0;
  const totalSelected = selectionStats?.total_selected || 0;
  const selectionRatio = totalShortlisted > 0 ? (totalSelected / totalShortlisted) * 100 : 0;
  
  const genderRatioShortlist = totalShortlisted > 0 
    ? `${shortlistStats.male_count || 0}:${shortlistStats.female_count || 0}` 
    : null;
  const genderRatioSelected = totalSelected > 0 
    ? `${selectionStats.male_count || 0}:${selectionStats.female_count || 0}` 
    : null;
  
  db.prepare(`
    INSERT INTO company_analytics (
      company_id,
      min_cgpa_shortlist, avg_cgpa_shortlist, 
      min_tenth_shortlist, avg_tenth_shortlist,
      min_twelfth_shortlist, avg_twelfth_shortlist, 
      total_shortlisted,
      male_count_shortlist, female_count_shortlist, 
      gender_ratio_shortlist,
      min_cgpa_selected, avg_cgpa_selected,
      min_tenth_selected, avg_tenth_selected,
      min_twelfth_selected, avg_twelfth_selected,
      total_selected,
      male_count_selected, female_count_selected,
      gender_ratio_selected,
      selection_ratio
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(company_id) DO UPDATE SET
      min_cgpa_shortlist = excluded.min_cgpa_shortlist,
      avg_cgpa_shortlist = excluded.avg_cgpa_shortlist,
      min_tenth_shortlist = excluded.min_tenth_shortlist,
      avg_tenth_shortlist = excluded.avg_tenth_shortlist,
      min_twelfth_shortlist = excluded.min_twelfth_shortlist,
      avg_twelfth_shortlist = excluded.avg_twelfth_shortlist,
      total_shortlisted = excluded.total_shortlisted,
      male_count_shortlist = excluded.male_count_shortlist,
      female_count_shortlist = excluded.female_count_shortlist,
      gender_ratio_shortlist = excluded.gender_ratio_shortlist,
      min_cgpa_selected = excluded.min_cgpa_selected,
      avg_cgpa_selected = excluded.avg_cgpa_selected,
      min_tenth_selected = excluded.min_tenth_selected,
      avg_tenth_selected = excluded.avg_tenth_selected,
      min_twelfth_selected = excluded.min_twelfth_selected,
      avg_twelfth_selected = excluded.avg_twelfth_selected,
      total_selected = excluded.total_selected,
      male_count_selected = excluded.male_count_selected,
      female_count_selected = excluded.female_count_selected,
      gender_ratio_selected = excluded.gender_ratio_selected,
      selection_ratio = excluded.selection_ratio
  `).run(
    companyId,
    totalShortlisted > 0 ? shortlistStats?.min_cgpa : null,
    totalShortlisted > 0 ? shortlistStats?.avg_cgpa : null,
    totalShortlisted > 0 ? shortlistStats?.min_tenth : null,
    totalShortlisted > 0 ? shortlistStats?.avg_tenth : null,
    totalShortlisted > 0 ? shortlistStats?.min_twelfth : null,
    totalShortlisted > 0 ? shortlistStats?.avg_twelfth : null,
    totalShortlisted,
    totalShortlisted > 0 ? (shortlistStats?.male_count || 0) : 0,
    totalShortlisted > 0 ? (shortlistStats?.female_count || 0) : 0,
    genderRatioShortlist,
    totalSelected > 0 ? selectionStats?.min_cgpa : null,
    totalSelected > 0 ? selectionStats?.avg_cgpa : null,
    totalSelected > 0 ? selectionStats?.min_tenth : null,
    totalSelected > 0 ? selectionStats?.avg_tenth : null,
    totalSelected > 0 ? selectionStats?.min_twelfth : null,
    totalSelected > 0 ? selectionStats?.avg_twelfth : null,
    totalSelected,
    totalSelected > 0 ? (selectionStats?.male_count || 0) : 0,
    totalSelected > 0 ? (selectionStats?.female_count || 0) : 0,
    genderRatioSelected,
    selectionRatio
  );
}

app.use('/*', serveStatic({ root: './dist' }));

const port = Number(process.env.PORT) || 3001;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
