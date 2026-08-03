/**
 * temp_index.ts
 * -----------------------------------------------------------------------
 * TESTING VERSION: All queries use the temp_ tables:
 *   temp_students       (PK: regno TEXT)
 *   temp_shortlists     (joins by regno TEXT OR neo_id TEXT)
 *   temp_selections     (joins by regno TEXT OR neo_id TEXT)
 *   temp_neoid_table    (PK: neoid TEXT)
 *
 * Run with:  npm run dev:temp
 * -----------------------------------------------------------------------
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import db from './db/index.js';

const app = new Hono();

app.use('/*', cors());

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', mode: 'temp-tables' });
});

// ---------------------------------------------------------------------------
// Helper join conditions for temp_shortlists / temp_selections
// A row can be linked either by regno OR neo_id — not all students have neo_ids
// ---------------------------------------------------------------------------
const STUDENT_SHORTLIST_JOIN =
  `(s.regno = sl.regno OR (sl.neo_id IS NOT NULL AND sl.neo_id != '' AND s.neo_id = sl.neo_id))`;

const STUDENT_SELECTION_JOIN =
  `(s.regno = sel.regno OR (sel.neo_id IS NOT NULL AND sel.neo_id != '' AND s.neo_id = sel.neo_id))`;

// ---------------------------------------------------------------------------
// GET /api/students  — paginated, searchable
// ---------------------------------------------------------------------------
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
    conditions.push(
      `(s.campus = 'Chennai' OR s.campus LIKE '%Chennai%') AND (s.neo_id IS NULL OR s.neo_id = '' OR s.neo_id = 'Unknown')`
    );
  }

  if (mastersFilter) {
    conditions.push(`s.masters = 1`);
  }

  if (search) {
    conditions.push(`(s.name LIKE ? OR s.regno LIKE ? OR s.neo_id LIKE ? OR s.branch LIKE ? OR s.campus LIKE ?)`);
    const sp = `%${search}%`;
    params.push(sp, sp, sp, sp, sp);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Total matching count
  const countSql = `SELECT COUNT(*) as count FROM temp_students s ${whereClause}`;
  const totalRow = db.prepare(countSql).get(...params) as { count: number } | undefined;
  const totalCount = totalRow?.count ?? 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Global unmapped Chennai count
  const unmappedChennaiRow = db.prepare(
    `SELECT COUNT(*) as count FROM temp_students
     WHERE (campus = 'Chennai' OR campus LIKE '%Chennai%')
       AND (neo_id IS NULL OR neo_id = '' OR neo_id = 'Unknown')`
  ).get() as { count: number } | undefined;
  const unmappedChennaiCount = unmappedChennaiRow?.count ?? 0;

  // Global masters count
  const mastersRow = db.prepare(
    `SELECT COUNT(*) as count FROM temp_students WHERE masters = 1`
  ).get() as { count: number } | undefined;
  const mastersCount = mastersRow?.count ?? 0;

  // Sort order
  let orderClause = 'ORDER BY s.name ASC';
  if (sortByShortlists) {
    orderClause = 'ORDER BY shortlist_count DESC, s.name ASC';
  }

  // Shortlist count sub-query accounts for both regno and neo_id linkage
  const dataSql = `
    SELECT
      s.*,
      (
        SELECT COUNT(*)
        FROM temp_shortlists sl
        WHERE ${STUDENT_SHORTLIST_JOIN}
      ) as shortlist_count
    FROM temp_students s
    ${whereClause}
    ${orderClause}
    LIMIT ? OFFSET ?
  `;

  const students = db.prepare(dataSql).all(...params, limit, offset);

  return c.json({ students, totalCount, unmappedChennaiCount, mastersCount, page, limit, totalPages });
});

// ---------------------------------------------------------------------------
// GET /api/students/by-shortlists  — top 50 by shortlist count
// ---------------------------------------------------------------------------
app.get('/api/students/by-shortlists', (c) => {
  const students = db.prepare(`
    SELECT s.*,
      COUNT(sl.id) as shortlist_count
    FROM temp_students s
    LEFT JOIN temp_shortlists sl ON ${STUDENT_SHORTLIST_JOIN}
    GROUP BY s.regno
    ORDER BY shortlist_count DESC, s.name ASC
    LIMIT 50
  `).all();

  return c.json({ students, totalCount: students.length, page: 1, limit: 50, totalPages: 1 });
});

// ---------------------------------------------------------------------------
// GET /api/students/search/:regno  — must be BEFORE /api/students/:regno
// ---------------------------------------------------------------------------
app.get('/api/students/search/:regno', (c) => {
  const regno = c.req.param('regno').toUpperCase();
  const student = db.prepare('SELECT * FROM temp_students WHERE UPPER(regno) = ?').get(regno);
  if (!student) return c.json({ error: 'Student not found' }, 404);
  return c.json(student);
});

// ---------------------------------------------------------------------------
// GET /api/students/:regno  — full detail with shortlists & selections
// NOTE: identifier is now regno (TEXT) not an integer id
// ---------------------------------------------------------------------------
app.get('/api/students/:regno', (c) => {
  const regno = c.req.param('regno').toUpperCase();
  const student = db.prepare('SELECT * FROM temp_students WHERE UPPER(regno) = ?').get(regno);

  if (!student) return c.json({ error: 'Student not found' }, 404);

  const s = student as any;

  // Shortlisted companies — match by regno OR by neo_id stored in shortlist row
  const shortlists = db.prepare(`
    SELECT co.*, sl.shortlisted_at, sl.round_number, sl.round_name
    FROM companies co
    JOIN temp_shortlists sl ON co.id = sl.company_id
    WHERE sl.regno = ?
       OR (sl.neo_id IS NOT NULL AND sl.neo_id != ''
           AND sl.neo_id = (SELECT neo_id FROM temp_students WHERE UPPER(regno) = ? LIMIT 1))
    ORDER BY sl.round_number ASC, sl.shortlisted_at DESC
  `).all(regno, regno);

  // Selected companies
  const selections = db.prepare(`
    SELECT co.*, sel.selected_at
    FROM companies co
    JOIN temp_selections sel ON co.id = sel.company_id
    WHERE sel.regno = ?
       OR (sel.neo_id IS NOT NULL AND sel.neo_id != ''
           AND sel.neo_id = (SELECT neo_id FROM temp_students WHERE UPPER(regno) = ? LIMIT 1))
    ORDER BY sel.selected_at DESC
  `).all(regno, regno);

  // Final company
  let finalCompany = null;
  if (s.final_company_id) {
    finalCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get(s.final_company_id);
  }

  return c.json({ ...student, shortlists, selections, finalCompany });
});

// ---------------------------------------------------------------------------
// PUT /api/students/:regno  — update student details
// ---------------------------------------------------------------------------
app.put('/api/students/:regno', async (c) => {
  const regno = c.req.param('regno').toUpperCase();
  const body = await c.req.json();

  const existing = db.prepare('SELECT regno FROM temp_students WHERE UPPER(regno) = ?').get(regno);
  if (!existing) return c.json({ error: 'Student not found' }, 404);

  let {
    name, email, phone, personal_email, gender,
    cgpa, tenth_marks, twelfth_marks, resume_link,
    branch, campus, neo_id, placed, masters, status, topcoder
  } = body;

  if (!name || !email) {
    return c.json({ error: 'Name and Email are required' }, 400);
  }

  if (!status) {
    if (masters) status = 'masters';
    else if (placed) status = 'placed';
    else status = 'not_placed';
  }

  const isPlaced = status === 'placed' || status === 'intern';
  const isMasters = status === 'masters';
  const isTopcoder = topcoder ? 1 : 0;

  db.prepare(`
    UPDATE temp_students
    SET name = ?,
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
    WHERE UPPER(regno) = ?
  `).run(
    name,
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
    regno
  );

  // Upsert into temp_neoid_table if neo_id provided
  if (neo_id && String(neo_id).trim()) {
    const trimmedNeoId = String(neo_id).trim();
    db.prepare(`
      INSERT INTO temp_neoid_table (neoid, campus, regno, topcoder)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(neoid) DO UPDATE SET campus = excluded.campus, regno = excluded.regno, topcoder = excluded.topcoder
    `).run(trimmedNeoId, campus || 'Chennai', regno, isTopcoder);
  }

  const updated = db.prepare('SELECT * FROM temp_students WHERE UPPER(regno) = ?').get(regno);
  return c.json(updated);
});

// ---------------------------------------------------------------------------
// GET /api/neo-ids  — list all neo_id mappings
// ---------------------------------------------------------------------------
app.get('/api/neo-ids', (c) => {
  const records = db.prepare('SELECT * FROM temp_neoid_table ORDER BY neoid').all();
  return c.json(records);
});

// ---------------------------------------------------------------------------
// GET /api/companies
// ---------------------------------------------------------------------------
app.get('/api/companies', (c) => {
  const companies = db.prepare('SELECT * FROM companies ORDER BY name').all();
  return c.json(companies);
});

// ---------------------------------------------------------------------------
// GET /api/companies/:id  — company detail with shortlist rounds & selections
// ---------------------------------------------------------------------------
app.get('/api/companies/:id', (c) => {
  const id = c.req.param('id');
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
  if (!company) return c.json({ error: 'Company not found' }, 404);

  const analytics = db.prepare('SELECT * FROM company_analytics WHERE company_id = ?').get(id);

  // Shortlisted students — join via regno OR neo_id
  const shortlisted = db.prepare(`
    SELECT s.*, sl.shortlisted_at, sl.round_number, sl.round_name
    FROM temp_students s
    JOIN temp_shortlists sl ON ${STUDENT_SHORTLIST_JOIN}
    WHERE sl.company_id = ?
    ORDER BY sl.round_number DESC, s.cgpa DESC
  `).all(id);

  // Group by round
  const roundMap = new Map<number, {
    round_number: number; round_name: string; students: any[];
    chennai_count: number; unknown_count: number;
  }>();
  for (const st of shortlisted as any[]) {
    const rNum = st.round_number || 1;
    const rName = st.round_name || `Shortlist ${rNum}`;
    if (!roundMap.has(rNum)) {
      roundMap.set(rNum, { round_number: rNum, round_name: rName, students: [], chennai_count: 0, unknown_count: 0 });
    }
    const rObj = roundMap.get(rNum)!;
    rObj.students.push(st);
    if (!st.campus || st.campus === 'Unknown') rObj.unknown_count++;
    else if (st.campus === 'Chennai') rObj.chennai_count++;
  }
  const shortlist_rounds = Array.from(roundMap.values()).sort((a, b) => b.round_number - a.round_number);

  // Selected students
  const selected = db.prepare(`
    SELECT s.*, sel.selected_at
    FROM temp_students s
    JOIN temp_selections sel ON ${STUDENT_SELECTION_JOIN}
    WHERE sel.company_id = ?
    ORDER BY s.cgpa DESC
  `).all(id);

  // Placed students (via final_company_id on temp_students)
  const placed = db.prepare(
    `SELECT * FROM temp_students WHERE final_company_id = ?`
  ).all(id);

  return c.json({ ...company, analytics, shortlisted, shortlist_rounds, selected, placed });
});

// ---------------------------------------------------------------------------
// POST /api/companies  — create company
// ---------------------------------------------------------------------------
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
    db.prepare('INSERT INTO company_analytics (company_id) VALUES (?)').run(result.lastInsertRowid);
    const created = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid);
    return c.json(created);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/companies/:id  — update company
// ---------------------------------------------------------------------------
app.put('/api/companies/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { name, notes, rounds, ctc, total_rounds, round_details, experience_required } = body;
  try {
    db.prepare(
      'UPDATE companies SET name = ?, notes = ?, rounds = ?, ctc = ?, total_rounds = ?, round_details = ?, experience_required = ? WHERE id = ?'
    ).run(
      name, notes || null,
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

// ---------------------------------------------------------------------------
// POST /api/companies/recalculate-analytics
// ---------------------------------------------------------------------------
app.post('/api/companies/recalculate-analytics', async (c) => {
  try {
    const companies = db.prepare('SELECT id, name FROM companies').all() as Array<{ id: number; name: string }>;
    let successCount = 0, errorCount = 0;
    const errors: any[] = [];
    for (const company of companies) {
      try { updateCompanyAnalytics(company.id); successCount++; }
      catch (error: any) {
        errorCount++;
        errors.push({ companyId: company.id, companyName: company.name, error: error.message });
      }
    }
    return c.json({
      success: true,
      message: `Recalculated analytics for ${successCount} companies`,
      successCount, errorCount,
      errors: errorCount > 0 ? errors : undefined
    });
  } catch (error: any) {
    return c.json({ error: 'Internal server error', details: error.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Helper: resolve a token (regno OR neo_id) → temp_students row
// ---------------------------------------------------------------------------
function resolveStudentToken(token: string) {
  const clean = token.trim();
  if (!clean) return null;
  const upper = clean.toUpperCase();

  // 1. Direct regno match
  let student = db.prepare(
    'SELECT regno, neo_id FROM temp_students WHERE UPPER(regno) = ?'
  ).get(upper) as { regno: string; neo_id: string | null } | null;
  if (student) return { student, token: upper, resolvedAs: 'regno' };

  // 2. Direct neo_id match on temp_students
  student = db.prepare(
    'SELECT regno, neo_id FROM temp_students WHERE neo_id = ?'
  ).get(upper) as { regno: string; neo_id: string | null } | null;
  if (student) return { student, token: upper, resolvedAs: 'neo_id' };

  // 3. Check temp_neoid_table for a mapped regno
  const neoRec = db.prepare(
    'SELECT * FROM temp_neoid_table WHERE UPPER(neoid) = ?'
  ).get(upper) as { neoid: string; campus: string; regno: string | null } | null;

  if (neoRec?.regno) {
    student = db.prepare(
      'SELECT regno, neo_id FROM temp_students WHERE UPPER(regno) = ?'
    ).get(neoRec.regno.toUpperCase()) as { regno: string; neo_id: string | null } | null;
    if (student) return { student, token: upper, resolvedAs: 'neoid_table' };
  }

  // 4. Not found — track in temp_neoid_table for future mapping
  db.prepare(`
    INSERT INTO temp_neoid_table (neoid, campus)
    VALUES (?, 'Unknown')
    ON CONFLICT(neoid) DO NOTHING
  `).run(upper);

  return { student: null, token: upper, resolvedAs: null, trackedInNeoIdTable: true };
}

// ---------------------------------------------------------------------------
// POST /api/companies/:id/shortlist
// ---------------------------------------------------------------------------
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
          // Record by neo_id only so it can be matched later when student registers
          const upper = resolved.token;
          try {
            db.prepare(`
              INSERT OR IGNORE INTO temp_shortlists (regno, neo_id, company_id, round_number, round_name)
              VALUES (NULL, ?, ?, ?, ?)
            `).run(upper, companyId, roundNumber, roundName);
            errors.push({
              identifier: upper,
              error: 'Not in temp_students. Shortlist row recorded by neo_id for future matching.'
            });
          } catch (e: any) {
            errors.push({ identifier: upper, error: e.message });
          }
          continue;
        }

        const { regno, neo_id } = resolved.student;
        const insertResult = db.prepare(`
          INSERT OR REPLACE INTO temp_shortlists (regno, neo_id, company_id, round_number, round_name)
          VALUES (?, ?, ?, ?, ?)
        `).run(regno, neo_id ?? null, companyId, roundNumber, roundName);

        results.push({
          identifier: resolved.token, regno, round: roundName,
          success: true,
          note: insertResult.changes === 0 ? 'Already shortlisted for this round' : undefined
        });
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

// ---------------------------------------------------------------------------
// PUT /api/companies/:id/shortlist-round/:roundNumber  — rename a round
// ---------------------------------------------------------------------------
app.put('/api/companies/:id/shortlist-round/:roundNumber', async (c) => {
  try {
    const companyId = c.req.param('id');
    const roundNumber = parseInt(c.req.param('roundNumber'));
    const body = await c.req.json();
    const roundName = body.round_name ? String(body.round_name).trim() : '';
    if (!roundName) return c.json({ error: 'Custom shortlist round name is required' }, 400);

    const result = db.prepare(`
      UPDATE temp_shortlists SET round_name = ?
      WHERE company_id = ? AND round_number = ?
    `).run(roundName, companyId, roundNumber);

    return c.json({ success: true, updatedCount: result.changes, round_number: roundNumber, round_name: roundName });
  } catch (error: any) {
    return c.json({ error: 'Internal server error', details: error.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/companies/:id/selections  — add final selections
// ---------------------------------------------------------------------------
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
          const upper = resolved.token;
          try {
            db.prepare(`
              INSERT OR IGNORE INTO temp_selections (regno, neo_id, company_id)
              VALUES (NULL, ?, ?)
            `).run(upper, companyId);
            errors.push({
              identifier: upper,
              error: 'Not in temp_students. Selection recorded by neo_id for future matching.'
            });
          } catch (e: any) {
            errors.push({ identifier: upper, error: e.message });
          }
          continue;
        }

        const { regno, neo_id } = resolved.student;
        const insertResult = db.prepare(
          'INSERT OR IGNORE INTO temp_selections (regno, neo_id, company_id) VALUES (?, ?, ?)'
        ).run(regno, neo_id ?? null, companyId);

        // Mark student placed
        db.prepare(
          'UPDATE temp_students SET placed = 1, status = ?, final_company_id = ? WHERE UPPER(regno) = ?'
        ).run(selectionStatus, companyId, regno);

        results.push({
          identifier: resolved.token, regno, success: true,
          note: insertResult.changes === 0 ? 'Already selected' : undefined
        });
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

// ---------------------------------------------------------------------------
// POST /api/students/:regno/place
// ---------------------------------------------------------------------------
app.post('/api/students/:regno/place', async (c) => {
  const regno = c.req.param('regno').toUpperCase();
  const body = await c.req.json();
  const { companyId } = body;
  try {
    db.prepare(
      'UPDATE temp_students SET placed = 1, final_company_id = ? WHERE UPPER(regno) = ?'
    ).run(companyId, regno);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// ---------------------------------------------------------------------------
// POST /api/predict-companies
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// GET /api/analytics/summary
// ---------------------------------------------------------------------------
app.get('/api/analytics/summary', (c) => {
  const totalStudents = db.prepare('SELECT COUNT(*) as count FROM temp_students').get() as any;
  const internedStudents = db.prepare(
    `SELECT COUNT(*) as count FROM temp_students WHERE placed = 1 OR status IN ('placed', 'intern')`
  ).get() as any;
  const totalCompanies = db.prepare('SELECT COUNT(*) as count FROM companies').get() as any;

  const branchStats = db.prepare(`
    SELECT branch, COUNT(*) as total,
      SUM(CASE WHEN placed = 1 OR status IN ('placed', 'intern') THEN 1 ELSE 0 END) as placed
    FROM temp_students
    GROUP BY branch
  `).all();

  const campusStats = db.prepare(`
    SELECT campus, COUNT(*) as total,
      SUM(CASE WHEN placed = 1 OR status IN ('placed', 'intern') THEN 1 ELSE 0 END) as placed
    FROM temp_students
    GROUP BY campus
  `).all();

  const topCompanies = db.prepare(`
    SELECT c.name, COUNT(ts.regno) as placed_count
    FROM companies c
    LEFT JOIN temp_students ts ON c.id = ts.final_company_id
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

// ---------------------------------------------------------------------------
// updateCompanyAnalytics — uses temp tables for shortlist/selection stats
// ---------------------------------------------------------------------------
function updateCompanyAnalytics(companyId: number) {
  const shortlistStats = db.prepare(`
    SELECT
      MIN(s.cgpa) as min_cgpa,
      AVG(s.cgpa) as avg_cgpa,
      MIN(s.tenth_marks) as min_tenth,
      AVG(s.tenth_marks) as avg_tenth,
      MIN(s.twelfth_marks) as min_twelfth,
      AVG(s.twelfth_marks) as avg_twelfth,
      COUNT(*) as total_shortlisted,
      SUM(CASE WHEN s.gender IN ('Male','M') THEN 1 ELSE 0 END) as male_count,
      SUM(CASE WHEN s.gender IN ('Female','F') THEN 1 ELSE 0 END) as female_count
    FROM temp_students s
    JOIN temp_shortlists sl ON ${STUDENT_SHORTLIST_JOIN}
    WHERE sl.company_id = ?
  `).get(companyId) as any;

  const selectionStats = db.prepare(`
    SELECT
      MIN(s.cgpa) as min_cgpa,
      AVG(s.cgpa) as avg_cgpa,
      MIN(s.tenth_marks) as min_tenth,
      AVG(s.tenth_marks) as avg_tenth,
      MIN(s.twelfth_marks) as min_twelfth,
      AVG(s.twelfth_marks) as avg_twelfth,
      COUNT(*) as total_selected,
      SUM(CASE WHEN s.gender IN ('Male','M') THEN 1 ELSE 0 END) as male_count,
      SUM(CASE WHEN s.gender IN ('Female','F') THEN 1 ELSE 0 END) as female_count
    FROM temp_students s
    JOIN temp_selections sel ON ${STUDENT_SELECTION_JOIN}
    WHERE sel.company_id = ?
  `).get(companyId) as any;

  const totalShortlisted = shortlistStats?.total_shortlisted || 0;
  const totalSelected = selectionStats?.total_selected || 0;
  const selectionRatio = totalShortlisted > 0 ? (totalSelected / totalShortlisted) * 100 : 0;

  const genderRatioShortlist = totalShortlisted > 0
    ? `${shortlistStats.male_count || 0}:${shortlistStats.female_count || 0}` : null;
  const genderRatioSelected = totalSelected > 0
    ? `${selectionStats.male_count || 0}:${selectionStats.female_count || 0}` : null;

  db.prepare(`
    INSERT INTO company_analytics (
      company_id,
      min_cgpa_shortlist, avg_cgpa_shortlist,
      min_tenth_shortlist, avg_tenth_shortlist,
      min_twelfth_shortlist, avg_twelfth_shortlist,
      total_shortlisted, male_count_shortlist, female_count_shortlist, gender_ratio_shortlist,
      min_cgpa_selected, avg_cgpa_selected,
      min_tenth_selected, avg_tenth_selected,
      min_twelfth_selected, avg_twelfth_selected,
      total_selected, male_count_selected, female_count_selected, gender_ratio_selected,
      selection_ratio
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

// ---------------------------------------------------------------------------
// Static frontend
// ---------------------------------------------------------------------------
app.use('/*', serveStatic({ root: './dist' }));

const port = Number(process.env.PORT) || 3001;
console.log(`[TEMP MODE] Server running on port ${port} — using temp_ tables`);

serve({ fetch: app.fetch, port });
