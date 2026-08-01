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

// Get all students
app.get('/api/students', (c) => {
  const students = db.prepare(`
    SELECT 
      s.*,
      (SELECT COUNT(*) FROM shortlists WHERE student_id = s.id) as shortlist_count
    FROM students s 
    ORDER BY name
  `).all();
  return c.json(students);
});

// Get students sorted by shortlist count (must be BEFORE :id route)
app.get('/api/students/by-shortlists', (c) => {
  const students = db.prepare(`
    SELECT s.*, COUNT(sl.id) as shortlist_count
    FROM students s
    LEFT JOIN shortlists sl ON s.id = sl.student_id
    GROUP BY s.id
    ORDER BY shortlist_count DESC, s.name ASC
  `).all();
  
  return c.json(students);
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
    SELECT c.*, s.shortlisted_at 
    FROM companies c
    JOIN shortlists s ON c.id = s.company_id
    WHERE s.student_id = ?
    ORDER BY s.shortlisted_at DESC
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

// Get company by ID with analytics
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
    SELECT s.*, sl.shortlisted_at
    FROM students s
    JOIN shortlists sl ON s.id = sl.student_id
    WHERE sl.company_id = ?
    ORDER BY s.cgpa DESC
  `).all(id);
  
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
  
  return c.json({ ...company, analytics, shortlisted, selected, placed });
});

// Create company
app.post('/api/companies', async (c) => {
  const body = await c.req.json();
  const { name, notes, rounds, experience_required } = body;
  
  try {
    const result = db.prepare(
      'INSERT INTO companies (name, notes, rounds, experience_required) VALUES (?, ?, ?, ?)'
    ).run(name, notes || null, rounds || null, experience_required || null);
    
    // Initialize analytics
    db.prepare(
      'INSERT INTO company_analytics (company_id) VALUES (?)'
    ).run(result.lastInsertRowid);
    
    return c.json({ id: result.lastInsertRowid, name, notes, rounds, experience_required });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Update company
app.put('/api/companies/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { name, notes, rounds, experience_required } = body;
  
  try {
    db.prepare(
      'UPDATE companies SET name = ?, notes = ?, rounds = ?, experience_required = ? WHERE id = ?'
    ).run(name, notes || null, rounds || null, experience_required || null, id);
    
    return c.json({ id, name, notes, rounds, experience_required });
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

// Add students to company shortlist
app.post('/api/companies/:id/shortlist', async (c) => {
  try {
    const companyId = c.req.param('id');
    const body = await c.req.json();
    const { regnos } = body;
    
    console.log(`Adding students to company ${companyId}:`, regnos); // Debug log
    
    if (!Array.isArray(regnos)) {
      return c.json({ error: 'regnos must be an array' }, 400);
    }
    
    const results: any[] = [];
    const errors: any[] = [];
    
    for (const regno of regnos) {
      try {
        const normalizedRegno = regno.toUpperCase().trim();
        const student = db.prepare('SELECT id FROM students WHERE regno = ?').get(normalizedRegno);
        
        if (!student) {
          console.log(`Student not found: ${normalizedRegno}`);
          errors.push({ regno: normalizedRegno, error: 'Student not found' });
          continue;
        }
        
        const studentId = (student as any).id;
        console.log(`Adding student ${studentId} (${normalizedRegno}) to company ${companyId}`);
        
        const insertResult = db.prepare(
          'INSERT OR IGNORE INTO shortlists (student_id, company_id) VALUES (?, ?)'
        ).run(studentId, companyId);
        
        if (insertResult.changes > 0) {
          results.push({ regno: normalizedRegno, success: true });
          console.log(`Successfully added student ${normalizedRegno}`);
        } else {
          results.push({ regno: normalizedRegno, success: true, note: 'Already shortlisted' });
          console.log(`Student ${normalizedRegno} already shortlisted`);
        }
      } catch (error: any) {
        console.error(`Error adding student ${regno}:`, error);
        errors.push({ regno, error: error.message });
      }
    }
    
    // Update analytics
    updateCompanyAnalytics(parseInt(companyId));
    
    console.log(`Results: ${results.length} success, ${errors.length} errors`);
    return c.json({ results, errors });
  } catch (error: any) {
    console.error('Error in shortlist endpoint:', error);
    return c.json({ error: 'Internal server error', details: error.message }, 500);
  }
});

// Add students to company selections (final selection)
app.post('/api/companies/:id/selections', async (c) => {
  try {
    const companyId = c.req.param('id');
    const body = await c.req.json();
    const { regnos } = body;
    
    console.log(`Adding selected students to company ${companyId}:`, regnos);
    
    if (!Array.isArray(regnos)) {
      return c.json({ error: 'regnos must be an array' }, 400);
    }
    
    const results: any[] = [];
    const errors: any[] = [];
    
    for (const regno of regnos) {
      try {
        const normalizedRegno = regno.toUpperCase().trim();
        const student = db.prepare('SELECT id FROM students WHERE regno = ?').get(normalizedRegno);
        
        if (!student) {
          console.log(`Student not found: ${normalizedRegno}`);
          errors.push({ regno: normalizedRegno, error: 'Student not found' });
          continue;
        }
        
        const studentId = (student as any).id;
        console.log(`Adding student ${studentId} (${normalizedRegno}) to company ${companyId} selections`);
        
        const insertResult = db.prepare(
          'INSERT OR IGNORE INTO selections (student_id, company_id) VALUES (?, ?)'
        ).run(studentId, companyId);
        
        // Also mark student as placed
        db.prepare(
          'UPDATE students SET placed = 1, final_company_id = ? WHERE id = ?'
        ).run(companyId, studentId);
        
        if (insertResult.changes > 0) {
          results.push({ regno: normalizedRegno, success: true });
          console.log(`Successfully added student ${normalizedRegno} to selections`);
        } else {
          results.push({ regno: normalizedRegno, success: true, note: 'Already selected' });
          console.log(`Student ${normalizedRegno} already selected`);
        }
      } catch (error: any) {
        console.error(`Error adding student ${regno} to selections:`, error);
        errors.push({ regno, error: error.message });
      }
    }
    
    // Update analytics
    updateCompanyAnalytics(parseInt(companyId));
    
    console.log(`Selection results: ${results.length} success, ${errors.length} errors`);
    return c.json({ results, errors });
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
  const placedStudents = db.prepare('SELECT COUNT(*) as count FROM students WHERE placed = 1').get() as any;
  const totalCompanies = db.prepare('SELECT COUNT(*) as count FROM companies').get() as any;
  
  const branchStats = db.prepare(`
    SELECT branch, COUNT(*) as total, SUM(placed) as placed
    FROM students
    GROUP BY branch
  `).all();
  
  const campusStats = db.prepare(`
    SELECT campus, COUNT(*) as total, SUM(placed) as placed
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
    placedStudents: placedStudents.count,
    totalCompanies: totalCompanies.count,
    placementRate: ((placedStudents.count / totalStudents.count) * 100).toFixed(2),
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
  
  if (totalShortlisted > 0 || totalSelected > 0) {
    const genderRatioShortlist = totalShortlisted > 0 
      ? `${shortlistStats.male_count}:${shortlistStats.female_count}` 
      : null;
    const genderRatioSelected = totalSelected > 0 
      ? `${selectionStats.male_count}:${selectionStats.female_count}` 
      : null;
    
    db.prepare(`
      UPDATE company_analytics
      SET min_cgpa_shortlist = ?, avg_cgpa_shortlist = ?, 
          min_tenth_shortlist = ?, avg_tenth_shortlist = ?,
          min_twelfth_shortlist = ?, avg_twelfth_shortlist = ?, 
          total_shortlisted = ?,
          male_count_shortlist = ?, female_count_shortlist = ?, 
          gender_ratio_shortlist = ?,
          min_cgpa_selected = ?, avg_cgpa_selected = ?,
          min_tenth_selected = ?, avg_tenth_selected = ?,
          min_twelfth_selected = ?, avg_twelfth_selected = ?,
          total_selected = ?,
          male_count_selected = ?, female_count_selected = ?,
          gender_ratio_selected = ?,
          selection_ratio = ?
      WHERE company_id = ?
    `).run(
      shortlistStats?.min_cgpa || null, shortlistStats?.avg_cgpa || null,
      shortlistStats?.min_tenth || null, shortlistStats?.avg_tenth || null,
      shortlistStats?.min_twelfth || null, shortlistStats?.avg_twelfth || null,
      totalShortlisted,
      shortlistStats?.male_count || 0, shortlistStats?.female_count || 0,
      genderRatioShortlist,
      selectionStats?.min_cgpa || null, selectionStats?.avg_cgpa || null,
      selectionStats?.min_tenth || null, selectionStats?.avg_tenth || null,
      selectionStats?.min_twelfth || null, selectionStats?.avg_twelfth || null,
      totalSelected,
      selectionStats?.male_count || 0, selectionStats?.female_count || 0,
      genderRatioSelected,
      selectionRatio,
      companyId
    );
  }
}

app.use('/*', serveStatic({ root: './dist' }));

const port = Number(process.env.PORT) || 3001;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
