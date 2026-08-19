import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { getCookie, setCookie } from 'hono/cookie';
import db from './db/index.js';
import { extractCleanTokens } from './utils.js';
import crypto from 'crypto';

const app = new Hono();

const ADMIN_PASSWORD_HASH = '30fde358b34772de141e11ba599e28f9f44aa80ae89aaf243b73e6b9b9ebc896'; // SHA-256 of "dream"

function verifyAdminPassword(c: any) {
  const pwd = c.req.header('X-Admin-Password') || '';
  const hash = crypto.createHash('sha256').update(pwd).digest('hex');
  return hash === ADMIN_PASSWORD_HASH;
}

app.use('/*', cors());

const SESSION_COOKIE_NAME = 'tracker_auth_session';
const loginAttempts = new Map<string, { lastAttempt: number, failures: number }>();

app.post('/api/login', async (c) => {
  const ip = c.req.header('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const attemptData = loginAttempts.get(ip) || { lastAttempt: 0, failures: 0 };
  
  // Calculate exponential backoff: 0s, 2s, 4s, 8s, 16s...
  const waitTimeMs = attemptData.failures > 0 ? (2 ** attemptData.failures) * 1000 : 0;
  
  if (now - attemptData.lastAttempt < waitTimeMs) {
    const remainingSeconds = Math.ceil((waitTimeMs - (now - attemptData.lastAttempt)) / 1000);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return c.json({ error: `Too many attempts. Please wait ${remainingSeconds} seconds.` }, 429);
  }
  
  attemptData.lastAttempt = now;
  loginAttempts.set(ip, attemptData);

  const body = await c.req.json().catch(() => ({}));
  const password = body.password || '';
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  
  if (hash === ADMIN_PASSWORD_HASH) {
    // Reset on success
    loginAttempts.delete(ip);
    
    setCookie(c, SESSION_COOKIE_NAME, 'authenticated', {
      maxAge: 60 * 60 * 24, // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/'
    });
    return c.json({ success: true });
  }
  
  // Increment failures on wrong password
  attemptData.failures += 1;
  loginAttempts.set(ip, attemptData);
  
  return c.json({ error: 'Invalid password' }, 401);
});

app.use('*', async (c, next) => {
  const path = c.req.path;
  
  // Allow login endpoint
  if (path === '/api/login') {
    return next();
  }
  
  // Allow static assets (js, css, images) to load so the frontend doesn't break
  const isAsset = path.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot)$/);
  if (isAsset) {
    return next();
  }
  
  const authCookie = getCookie(c, SESSION_COOKIE_NAME);
  if (authCookie === 'authenticated') {
    return next();
  }

  // Not authenticated
  const isApi = path.startsWith('/api/');
  if (isApi) {
    return c.json({ error: 'Unauthorized. Please login.' }, 401);
  } else {
    // Return a simple login page for all HTML routes
    return c.html(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Placement Tracker - Login</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #0f172a; color: white; margin: 0; }
          .card { background: #1e293b; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); width: 100%; max-width: 350px; text-align: center; }
          h2 { margin-top: 0; color: #f8fafc; }
          input { width: 100%; padding: 0.75rem; margin-top: 1rem; margin-bottom: 1rem; border-radius: 4px; border: 1px solid #334155; background: #0f172a; color: white; box-sizing: border-box; font-size: 1rem; }
          input:focus { outline: none; border-color: #3b82f6; }
          button { width: 100%; padding: 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 1rem; transition: background 0.2s; }
          button:hover { background: #2563eb; }
          #error { color: #ef4444; margin-top: 1rem; display: none; font-size: 0.9rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Tracker Access</h2>
          <form id="loginForm">
            <input type="password" id="password" placeholder="Enter Password" required autofocus>
            <button type="submit">Login</button>
          </form>
          <div id="error">Invalid password</div>
        </div>
        <script>
          document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.querySelector('button');
            const err = document.getElementById('error');
            btn.textContent = 'Verifying...';
            btn.disabled = true;
            err.style.display = 'none';
            
            const pwd = document.getElementById('password').value;
            try {
              const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd })
              });
              if (res.ok) {
                window.location.reload();
              } else {
                const data = await res.json().catch(() => ({}));
                err.textContent = data.error || 'Invalid password';
                err.style.display = 'block';
                btn.textContent = 'Login';
                btn.disabled = false;
              }
            } catch (error) {
              err.textContent = 'Connection error';
              err.style.display = 'block';
              btn.textContent = 'Login';
              btn.disabled = false;
            }
          });
        </script>
      </body>
      </html>
    `);
  }
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// GET /api/students — paginated, searchable from temp_students
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
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching
  const countSql = `SELECT COUNT(*) as count FROM temp_students s ${whereClause}`;
  const totalRow = db.prepare(countSql).get(...params) as { count: number } | undefined;
  const totalCount = totalRow ? totalRow.count : 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Global count of unmapped Chennai students
  const unmappedChennaiRow = db.prepare(
    `SELECT COUNT(*) as count FROM temp_students WHERE (campus = 'Chennai' OR campus LIKE '%Chennai%') AND (neo_id IS NULL OR neo_id = '' OR neo_id = 'Unknown')`
  ).get() as { count: number } | undefined;
  const unmappedChennaiCount = unmappedChennaiRow ? unmappedChennaiRow.count : 0;

  // Global count of masters students
  const mastersRow = db.prepare(
    `SELECT COUNT(*) as count FROM temp_students WHERE masters = 1`
  ).get() as { count: number } | undefined;
  const mastersCount = mastersRow ? mastersRow.count : 0;

  const sortParam = c.req.query('sort') || (c.req.query('sortByShortlists') === 'true' ? 'shortlists' : 'default');

  let orderClause = 'ORDER BY s.name ASC';
  if (sortParam === 'shortlists') {
    orderClause = 'ORDER BY shortlist_count DESC, s.name ASC';
  } else if (sortParam === 'placed') {
    orderClause = `ORDER BY CASE WHEN s.status = 'placed' THEN 1 WHEN s.status = 'intern' THEN 2 WHEN s.status = 'masters' THEN 3 ELSE 4 END ASC, s.name ASC`;
  }

  const dataSql = `
    SELECT 
      s.*,
      (
        SELECT COUNT(*) 
        FROM temp_shortlists sl 
        WHERE (s.regno = sl.regno OR (sl.neo_id IS NOT NULL AND sl.neo_id != '' AND s.neo_id = sl.neo_id))
      ) as shortlist_count
    FROM temp_students s
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

// Get students sorted by shortlist count (must be BEFORE :regno route)
app.get('/api/students/by-shortlists', (c) => {
  const students = db.prepare(`
    SELECT s.*, 
      COUNT(sl.id) as shortlist_count
    FROM temp_students s
    LEFT JOIN temp_shortlists sl ON (s.regno = sl.regno OR (sl.neo_id IS NOT NULL AND sl.neo_id != '' AND s.neo_id = sl.neo_id))
    GROUP BY s.regno
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

// Search students by regno (must be BEFORE :regno route)
app.get('/api/students/search/:regno', (c) => {
  const regno = c.req.param('regno').toUpperCase();
  const student = db.prepare('SELECT * FROM temp_students WHERE UPPER(regno) = ? OR UPPER(neo_id) = ?').get(regno, regno);
  
  if (!student) {
    return c.json({ error: 'Student not found' }, 404);
  }
  
  return c.json(student);
});

// Get student by Regno / NeoID with full shortlists & selections
app.get('/api/students/:regno', (c) => {
  const param = c.req.param('regno').trim().toUpperCase();
  
  // 1. Try temp_students first
  let student = db.prepare(
    'SELECT * FROM temp_students WHERE UPPER(regno) = ? OR UPPER(neo_id) = ?'
  ).get(param, param) as any;
  
  // 2. Fallback to temp_neoid_table if not directly in temp_students
  if (!student) {
    const neoRec = db.prepare(
      'SELECT * FROM temp_neoid_table WHERE UPPER(neoid) = ? OR UPPER(regno) = ?'
    ).get(param, param) as any;
    
    if (neoRec) {
      if (neoRec.regno) {
        student = db.prepare('SELECT * FROM temp_students WHERE UPPER(regno) = ?').get(neoRec.regno.toUpperCase());
      }
      if (!student) {
        student = {
          regno: neoRec.regno || null,
          neo_id: neoRec.neoid,
          name: `Candidate (${neoRec.neoid})`,
          email: '',
          campus: neoRec.campus || 'Chennai',
          branch: 'Unknown',
          topcoder: neoRec.topcoder || 0,
          status: 'not_placed',
          placed: 0
        };
      }
    }
  }

  if (!student) {
    return c.json({ error: 'Student not found' }, 404);
  }

  const lookupRegno = student.regno ? student.regno.toUpperCase() : null;
  const lookupNeoid = student.neo_id ? student.neo_id.toUpperCase() : (param !== lookupRegno ? param : null);
  
  // Get shortlisted companies (temp_shortlists)
  const shortlists = db.prepare(`
    SELECT co.*, sl.shortlisted_at, sl.round_number, sl.round_name
    FROM companies co
    JOIN temp_shortlists sl ON co.id = sl.company_id
    WHERE (sl.regno IS NOT NULL AND UPPER(sl.regno) = ?)
       OR (sl.neo_id IS NOT NULL AND sl.neo_id != '' AND UPPER(sl.neo_id) = ?)
       OR (? IS NOT NULL AND UPPER(sl.neo_id) = ?)
    ORDER BY sl.round_number ASC, sl.shortlisted_at DESC
  `).all(lookupRegno || '', lookupNeoid || '', lookupNeoid || '', lookupNeoid || '');

  // Get intern selections (temp_interns_selected)
  const internSelections = db.prepare(`
    SELECT co.*, sel.selected_at, 'intern' as offer_type
    FROM companies co
    JOIN temp_interns_selected sel ON co.id = sel.company_id
    WHERE (sel.regno IS NOT NULL AND UPPER(sel.regno) = ?)
       OR (sel.neo_id IS NOT NULL AND sel.neo_id != '' AND UPPER(sel.neo_id) = ?)
       OR (? IS NOT NULL AND UPPER(sel.neo_id) = ?)
    ORDER BY sel.selected_at DESC
  `).all(lookupRegno || '', lookupNeoid || '', lookupNeoid || '', lookupNeoid || '');

  // Get final placements (temp_final_selection)
  const finalSelections = db.prepare(`
    SELECT co.*, fin.selected_at, 'placed' as offer_type
    FROM companies co
    JOIN temp_final_selection fin ON co.id = fin.company_id
    WHERE (fin.regno IS NOT NULL AND UPPER(fin.regno) = ?)
       OR (fin.neo_id IS NOT NULL AND fin.neo_id != '' AND UPPER(fin.neo_id) = ?)
       OR (? IS NOT NULL AND UPPER(fin.neo_id) = ?)
    ORDER BY fin.selected_at DESC
  `).all(lookupRegno || '', lookupNeoid || '', lookupNeoid || '', lookupNeoid || '');

  const selections = [...internSelections, ...finalSelections];

  // Get final company
  let finalCompany = null;
  if (student.final_company_id) {
    finalCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get(student.final_company_id);
  }

  return c.json({ ...student, shortlists, selections, finalCompany });
});

// Update student by Regno
app.put('/api/students/:regno', async (c) => {
  if (!verifyAdminPassword(c)) {
    return c.json({ error: 'Unauthorized: Invalid admin password' }, 401);
  }
  const param = c.req.param('regno').trim().toUpperCase();
  const body = await c.req.json();

  const existing = db.prepare(
    'SELECT * FROM temp_students WHERE UPPER(regno) = ? OR UPPER(neo_id) = ?'
  ).get(param, param) as any;

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

  const targetRegno = existing?.regno || regno || param;

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

  if (existing) {
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
      campus || 'Chennai',
      neo_id ? String(neo_id).trim() : null,
      isPlaced ? 1 : 0,
      isMasters ? 1 : 0,
      status,
      isTopcoder,
      targetRegno.toUpperCase()
    );
  }

  // Upsert into temp_neoid_table if neo_id is provided
  if (neo_id && String(neo_id).trim()) {
    const trimmedNeoId = String(neo_id).trim();
    db.prepare(`
      INSERT INTO temp_neoid_table (neoid, campus, regno, topcoder)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(neoid) DO UPDATE SET campus = excluded.campus, regno = excluded.regno, topcoder = excluded.topcoder
    `).run(trimmedNeoId, campus || 'Chennai', targetRegno, isTopcoder);
  }

  const updatedStudent = db.prepare(
    'SELECT * FROM temp_students WHERE UPPER(regno) = ?'
  ).get(targetRegno.toUpperCase());

  return c.json(updatedStudent || { success: true });
});

// Get all Neo IDs from temp_neoid_table
app.get('/api/neo-ids', (c) => {
  const records = db.prepare('SELECT * FROM temp_neoid_table ORDER BY neoid').all();
  return c.json(records);
});

// ---------------------------------------------------------------------------
// GET /api/neo-ids/search/:neoid — Look up a single Neo ID
// ---------------------------------------------------------------------------
app.get('/api/neo-ids/search/:neoid', (c) => {
  const neoid = c.req.param('neoid').trim().toUpperCase();

  const record = db.prepare(
    `SELECT * FROM temp_neoid_table WHERE UPPER(neoid) = ?`
  ).get(neoid) as { neoid: string; campus: string; regno: string | null; topcoder: number } | undefined;

  if (!record) {
    return c.json({ found: false, neoid });
  }

  // Try to find the student name from temp_students if regno is available
  let studentName: string | null = null;
  if (record.regno) {
    const student = db.prepare(
      `SELECT name FROM temp_students WHERE UPPER(regno) = ?`
    ).get(record.regno.toUpperCase()) as { name: string } | undefined;
    if (student) studentName = student.name;
  }

  return c.json({
    found: true,
    neoid: record.neoid,
    campus: record.campus,
    regno: record.regno,
    topcoder: !!record.topcoder,
    studentName
  });
});

// POST /api/neo-ids/batch-lookup — Batch Neo ID lookup
// ---------------------------------------------------------------------------
app.post('/api/neo-ids/batch-lookup', async (c) => {
  try {
    const body = await c.req.json();
    const neoids = body.neoids || [];
    
    if (!Array.isArray(neoids)) {
      return c.json({ error: 'Expected an array of neoids' }, 400);
    }

    const uniqueNeoids = [...new Set(neoids.map((n: string) => n.trim().toUpperCase()).filter(Boolean))];

    const results = [];
    
    const stmt = db.prepare(`
      SELECT n.*, s.name as studentName 
      FROM temp_neoid_table n 
      LEFT JOIN temp_students s ON UPPER(n.regno) = UPPER(s.regno) 
      WHERE UPPER(n.neoid) = ?
    `);

    for (const id of uniqueNeoids) {
      const record = stmt.get(id) as { neoid: string; campus: string; regno: string | null; topcoder: number; studentName: string | null } | undefined;
      
      if (record) {
        results.push({
          found: true,
          neoid: record.neoid,
          campus: record.campus,
          regno: record.regno,
          topcoder: !!record.topcoder,
          studentName: record.studentName
        });
      } else {
        results.push({
          found: false,
          neoid: id
        });
      }
    }
    
    return c.json({ results });
  } catch (err: any) {
    console.error('[POST /api/neo-ids/batch-lookup] Error:', err);
    return c.json({ error: err.message || 'Internal error' }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/neo-ids/batch-map-regno — Batch map Neo IDs → Registration Numbers
// ---------------------------------------------------------------------------
app.post('/api/neo-ids/batch-map-regno', async (c) => {
  if (!verifyAdminPassword(c)) {
    return c.json({ error: 'Invalid admin password' }, 401);
  }

  try {
    const body = await c.req.json();
    const mappings: { neoid: string; regno: string }[] = body.mappings || [];

    if (!mappings.length) {
      return c.json({ error: 'No mappings provided' }, 400);
    }

    const upsertNeoStmt = db.prepare(`
      INSERT INTO temp_neoid_table (neoid, campus, regno)
      VALUES (?, 'Unknown', ?)
      ON CONFLICT(neoid) DO UPDATE SET regno = excluded.regno
    `);

    const updateStudentStmt = db.prepare(`
      UPDATE temp_students SET neo_id = ? WHERE UPPER(regno) = ?
    `);

    const batchUpdate = db.transaction((items: { neoid: string; regno: string }[]) => {
      let neoCount = 0;
      let studentCount = 0;
      for (const item of items) {
        const neoid = item.neoid.trim().toUpperCase();
        const regno = item.regno.trim().toUpperCase();
        if (!neoid || !regno) continue;

        upsertNeoStmt.run(neoid, regno);
        neoCount++;

        const res = updateStudentStmt.run(neoid, regno);
        if (res.changes > 0) studentCount++;
      }
      return { neoCount, studentCount };
    });

    const result = batchUpdate(mappings);

    return c.json({
      success: true,
      message: `Mapped ${result.neoCount} Neo IDs to registration numbers. Updated ${result.studentCount} students.`,
      neoCount: result.neoCount,
      studentCount: result.studentCount
    });
  } catch (err: any) {
    console.error('[POST /api/neo-ids/batch-map-regno] Error:', err);
    return c.json({ error: 'Failed to batch map regnos', details: err?.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/neo-ids/batch-set-campus — Batch set campus for Neo IDs
// ---------------------------------------------------------------------------
app.post('/api/neo-ids/batch-set-campus', async (c) => {
  if (!verifyAdminPassword(c)) {
    return c.json({ error: 'Invalid admin password' }, 401);
  }

  try {
    const body = await c.req.json();
    const neoids: string[] = body.neoids || [];
    const campus: string = body.campus;

    if (!neoids.length) {
      return c.json({ error: 'No Neo IDs provided' }, 400);
    }

    const validCampuses = ['Chennai', 'Vellore', 'Unknown'];
    if (!validCampuses.includes(campus)) {
      return c.json({ error: `Invalid campus. Must be one of: ${validCampuses.join(', ')}` }, 400);
    }

    const upsertStmt = db.prepare(`
      INSERT INTO temp_neoid_table (neoid, campus)
      VALUES (?, ?)
      ON CONFLICT(neoid) DO UPDATE SET campus = excluded.campus
    `);

    const batchSetCampus = db.transaction((ids: string[], campusVal: string) => {
      let count = 0;
      for (const id of ids) {
        const neoid = id.trim().toUpperCase();
        if (!neoid) continue;
        upsertStmt.run(neoid, campusVal);
        count++;
      }
      return count;
    });

    const updatedCount = batchSetCampus(neoids, campus);

    return c.json({
      success: true,
      message: `Set campus to '${campus}' for ${updatedCount} Neo IDs.`,
      updatedCount
    });
  } catch (err: any) {
    console.error('[POST /api/neo-ids/batch-set-campus] Error:', err);
    return c.json({ error: 'Failed to batch set campus', details: err?.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/students/batch-lookup-names — Batch name lookup (fuzzy, case-insensitive)
// Jaro-Winkler >= 0.75 threshold; exact match always wins
// ---------------------------------------------------------------------------

/** Jaro similarity between two lowercased strings */
function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const l1 = s1.length, l2 = s2.length;
  if (l1 === 0 || l2 === 0) return 0;
  const md = Math.max(Math.floor(Math.max(l1, l2) / 2) - 1, 0);
  const m1 = new Uint8Array(l1), m2 = new Uint8Array(l2);
  let hits = 0, trans = 0;
  for (let i = 0; i < l1; i++) {
    const lo = Math.max(0, i - md), hi = Math.min(i + md + 1, l2);
    for (let j = lo; j < hi; j++) {
      if (m2[j] || s1[i] !== s2[j]) continue;
      m1[i] = m2[j] = 1; hits++; break;
    }
  }
  if (!hits) return 0;
  let k = 0;
  for (let i = 0; i < l1; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (s1[i] !== s2[k]) trans++;
    k++;
  }
  return (hits / l1 + hits / l2 + (hits - trans / 2) / hits) / 3;
}

/** Jaro-Winkler — boosts common-prefix matches */
function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  if (j < 0.7) return j;
  let p = 0;
  for (let i = 0; i < Math.min(a.length, b.length, 4); i++) {
    if (a[i] === b[i]) p++; else break;
  }
  return j + p * 0.1 * (1 - j);
}

/** Best score between query and any word-span / individual word in candidate */
function fuzzyScore(query: string, candidate: string): number {
  const qw = query.split(/\s+/), cw = candidate.split(/\s+/);
  let best = jaroWinkler(query, candidate);
  for (let s = 0; s <= cw.length - qw.length; s++) {
    const span = cw.slice(s, s + qw.length).join(' ');
    const sc = jaroWinkler(query, span);
    if (sc > best) best = sc;
  }
  for (const word of cw) {
    const sc = jaroWinkler(query, word);
    if (sc > best) best = sc;
  }
  return best;
}

const FUZZY_THRESHOLD = 0.75;

app.post('/api/students/batch-lookup-names', async (c) => {
  try {
    const body = await c.req.json();
    const names: string[] = body.names || [];

    if (!names.length) {
      return c.json({ error: 'No names provided' }, 400);
    }

    const exactStmt = db.prepare(
      `SELECT name, regno, neo_id FROM temp_students WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))`
    );
    const tokenStmt = db.prepare(
      `SELECT DISTINCT name, regno, neo_id FROM temp_students WHERE LOWER(name) LIKE ?`
    );

    const results: {
      searchedName: string;
      matches: { name: string; regno: string; neo_id: string | null; score: number }[];
      found: boolean;
    }[] = [];

    for (const inputName of names) {
      const trimmed = inputName.trim();
      if (!trimmed) continue;
      const queryLower = trimmed.toLowerCase();

      // 1. Exact case-insensitive match (fast / indexed)
      const exactMatches = exactStmt.all(trimmed) as { name: string; regno: string; neo_id: string | null }[];
      if (exactMatches.length > 0) {
        results.push({
          searchedName: trimmed,
          matches: exactMatches.map(m => ({ ...m, score: 1.0 })),
          found: true
        });
        continue;
      }

      // 2. Candidate pool: broad LIKE on full query + each token
      const candidateMap = new Map<string, { name: string; regno: string; neo_id: string | null }>();
      const broadRows = tokenStmt.all(`%${queryLower}%`) as { name: string; regno: string; neo_id: string | null }[];
      for (const r of broadRows) candidateMap.set(r.regno, r);
      const tokens = queryLower.split(/\s+/).filter(t => t.length >= 2);
      for (const tok of tokens) {
        const rows = tokenStmt.all(`%${tok}%`) as { name: string; regno: string; neo_id: string | null }[];
        for (const r of rows) candidateMap.set(r.regno, r);
      }

      // 3. Score candidates with Jaro-Winkler, keep >= threshold
      const scored = Array.from(candidateMap.values())
        .map(r => ({ ...r, score: fuzzyScore(queryLower, r.name.toLowerCase()) }))
        .filter(r => r.score >= FUZZY_THRESHOLD)
        .sort((a, b) => b.score - a.score);

      results.push({ searchedName: trimmed, matches: scored, found: scored.length > 0 });
    }

    return c.json({ results });
  } catch (err: any) {
    console.error('[POST /api/students/batch-lookup-names] Error:', err);
    return c.json({ error: 'Failed to lookup names', details: err?.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/students/recalculate-analytics — sync NeoIDs & placement statuses
// ---------------------------------------------------------------------------
app.post('/api/students/recalculate-analytics', (c) => {
  try {
    // 0. Auto-insert any unmatched NeoIDs from shortlists, selections, and students into temp_neoid_table with campus = 'Unknown'
    const syncUnmatchedNeoIdsResult = db.prepare(`
      INSERT INTO temp_neoid_table (neoid, campus)
      SELECT DISTINCT UPPER(TRIM(all_neo.neo_id)), 'Unknown'
      FROM (
        SELECT neo_id FROM temp_shortlists WHERE neo_id IS NOT NULL AND TRIM(neo_id) != ''
        UNION
        SELECT neo_id FROM temp_interns_selected WHERE neo_id IS NOT NULL AND TRIM(neo_id) != ''
        UNION
        SELECT neo_id FROM temp_final_selection WHERE neo_id IS NOT NULL AND TRIM(neo_id) != ''
        UNION
        SELECT neo_id FROM temp_students WHERE neo_id IS NOT NULL AND TRIM(neo_id) != ''
      ) all_neo
      WHERE UPPER(TRIM(all_neo.neo_id)) NOT IN (
        SELECT UPPER(TRIM(neoid)) FROM temp_neoid_table WHERE neoid IS NOT NULL
      )
      ON CONFLICT(neoid) DO NOTHING;
    `).run();

    db.prepare(`UPDATE temp_neoid_table SET campus = 'Unknown' WHERE campus IS NULL OR TRIM(campus) = ''`).run();

    // 1. Sync NeoIDs from temp_neoid_table to temp_students
    const syncNeoIdsResult = db.prepare(`
      UPDATE temp_students
      SET neo_id = (
        SELECT neoid FROM temp_neoid_table n
        WHERE UPPER(n.regno) = UPPER(temp_students.regno)
        LIMIT 1
      )
      WHERE regno IN (
        SELECT n2.regno FROM temp_neoid_table n2 WHERE n2.regno IS NOT NULL AND n2.regno != ''
      ) AND (neo_id IS NULL OR neo_id = '' OR neo_id != (SELECT neoid FROM temp_neoid_table n3 WHERE UPPER(n3.regno) = UPPER(temp_students.regno) LIMIT 1));
    `).run();

    // 2. Sync Final Placement Status (temp_final_selection -> temp_students)
    const syncFinalsResult = db.prepare(`
      UPDATE temp_students
      SET placed = 1,
          status = 'placed',
          final_company_id = (
            SELECT fin.company_id FROM temp_final_selection fin
            WHERE UPPER(fin.regno) = UPPER(temp_students.regno)
               OR (fin.neo_id IS NOT NULL AND fin.neo_id != '' AND UPPER(fin.neo_id) = UPPER(temp_students.neo_id))
            LIMIT 1
          )
      WHERE regno IN (SELECT fin2.regno FROM temp_final_selection fin2 WHERE fin2.regno IS NOT NULL)
         OR (neo_id IS NOT NULL AND neo_id != '' AND neo_id IN (SELECT fin3.neo_id FROM temp_final_selection fin3 WHERE fin3.neo_id IS NOT NULL));
    `).run();

    // 3. Sync Intern Selection Status (temp_interns_selected -> temp_students for non-fulltime placed candidates)
    const syncInternsResult = db.prepare(`
      UPDATE temp_students
      SET placed = 1,
          status = 'intern',
          final_company_id = (
            SELECT sel.company_id FROM temp_interns_selected sel
            WHERE UPPER(sel.regno) = UPPER(temp_students.regno)
               OR (sel.neo_id IS NOT NULL AND sel.neo_id != '' AND UPPER(sel.neo_id) = UPPER(temp_students.neo_id))
            LIMIT 1
          )
      WHERE (regno IN (SELECT sel2.regno FROM temp_interns_selected sel2 WHERE sel2.regno IS NOT NULL)
         OR (neo_id IS NOT NULL AND neo_id != '' AND neo_id IN (SELECT sel3.neo_id FROM temp_interns_selected sel3 WHERE sel3.neo_id IS NOT NULL)))
        AND status != 'placed';
    `).run();

    // 4. Reset stale placed flags for candidates not in any selection table (preserving masters status)
    const resetStaleResult = db.prepare(`
      UPDATE temp_students
      SET placed = 0,
          status = 'not_placed',
          final_company_id = NULL
      WHERE status != 'masters'
        AND regno NOT IN (
          SELECT regno FROM temp_final_selection WHERE regno IS NOT NULL
          UNION
          SELECT regno FROM temp_interns_selected WHERE regno IS NOT NULL
        )
        AND (
          neo_id IS NULL OR neo_id NOT IN (
            SELECT neo_id FROM temp_final_selection WHERE neo_id IS NOT NULL
            UNION
            SELECT neo_id FROM temp_interns_selected WHERE neo_id IS NOT NULL
          )
        )
        AND (placed = 1 OR status IN ('placed', 'intern') OR final_company_id IS NOT NULL);
    `).run();

    // Invalidate analytics in-memory summary cache so dashboard updates
    cachedAnalyticsSummary = null;

    return c.json({
      success: true,
      message: `Recalculated student analytics and NeoID mappings successfully.`,
      updatedNeoIds: syncNeoIdsResult.changes,
      updatedFinalPlacements: syncFinalsResult.changes,
      updatedInterns: syncInternsResult.changes,
      resetStaleCandidates: resetStaleResult.changes
    });
  } catch (err: any) {
    console.error('[POST /api/students/recalculate-analytics] Error:', err);
    return c.json({ error: 'Failed to recalculate student analytics', details: err?.message }, 500);
  }
});

// Get all companies (with latest shortlist info)
app.get('/api/companies', (c) => {
  const companies = db.prepare(`
    SELECT 
      c.*,
      (
        SELECT round_number 
        FROM temp_shortlists 
        WHERE company_id = c.id 
        ORDER BY round_number DESC, shortlisted_at DESC 
        LIMIT 1
      ) as latest_round_number,
      (
        SELECT round_name 
        FROM temp_shortlists 
        WHERE company_id = c.id 
        ORDER BY round_number DESC, shortlisted_at DESC 
        LIMIT 1
      ) as latest_round_name,
      (
        SELECT COUNT(DISTINCT round_number)
        FROM temp_shortlists
        WHERE company_id = c.id
      ) as total_shortlist_rounds,
      (
        SELECT COUNT(*)
        FROM temp_shortlists
        WHERE company_id = c.id
      ) as total_shortlisted_count
    FROM companies c
    ORDER BY c.name
  `).all();
  return c.json(companies);
});

// Get shortlist rounds summary for a company
app.get('/api/companies/:id/shortlist-rounds', (c) => {
  try {
    const id = c.req.param('id');
    const rounds = db.prepare(`
      SELECT 
        round_number, 
        round_name, 
        COUNT(*) as student_count,
        MAX(shortlisted_at) as latest_shortlisted_at
      FROM temp_shortlists
      WHERE company_id = ?
      GROUP BY round_number, round_name
      ORDER BY round_number ASC
    `).all(id) as any[];

    const latestRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;

    return c.json({
      rounds,
      latestRound,
      suggestedNextRoundNumber: latestRound ? (latestRound.round_number + 1) : 1
    });
  } catch (error: any) {
    console.error('Error fetching shortlist rounds:', error);
    return c.json({ error: 'Failed to fetch shortlist rounds', details: error.message }, 500);
  }
});

// Get company by ID with analytics, shortlists, intern selections, and final placements
app.get('/api/companies/:id', (c) => {
  try {
    const id = c.req.param('id');
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    if (!company) return c.json({ error: 'Company not found' }, 404);

    const analytics = db.prepare('SELECT * FROM company_analytics WHERE company_id = ?').get(id);

    // Shortlisted students — Optimized prioritized LEFT JOINs with NOCASE indexes
    const shortlisted = db.prepare(`
      WITH company_sl AS (
        SELECT id, company_id, regno, neo_id, round_number, round_name, shortlisted_at
        FROM temp_shortlists
        WHERE company_id = ?
      )
      SELECT
        sl.id as shortlist_entry_id,
        sl.shortlisted_at,
        sl.round_number,
        sl.round_name,
        COALESCE(s1.regno, s2.regno, s3.regno, sl.regno, n.regno) as regno,
        COALESCE(s1.name, s2.name, s3.name, CASE WHEN COALESCE(sl.neo_id, s1.neo_id, s2.neo_id, s3.neo_id, n.neoid) IS NOT NULL THEN 'Student (' || COALESCE(sl.neo_id, s1.neo_id, s2.neo_id, s3.neo_id, n.neoid) || ')' ELSE 'Student (' || COALESCE(sl.regno, 'Unmapped') || ')' END) as name,
        COALESCE(s1.email, s2.email, s3.email, '') as email,
        COALESCE(s1.phone, s2.phone, s3.phone) as phone,
        COALESCE(s1.personal_email, s2.personal_email, s3.personal_email) as personal_email,
        COALESCE(s1.gender, s2.gender, s3.gender) as gender,
        COALESCE(s1.cgpa, s2.cgpa, s3.cgpa) as cgpa,
        COALESCE(s1.tenth_marks, s2.tenth_marks, s3.tenth_marks) as tenth_marks,
        COALESCE(s1.twelfth_marks, s2.twelfth_marks, s3.twelfth_marks) as twelfth_marks,
        COALESCE(s1.resume_link, s2.resume_link, s3.resume_link) as resume_link,
        COALESCE(s1.branch, s2.branch, s3.branch, 'Unknown') as branch,
        COALESCE(s1.campus, s2.campus, s3.campus, n.campus, 'Chennai') as campus,
        COALESCE(s1.placed, s2.placed, s3.placed, 0) as placed,
        COALESCE(s1.final_company_id, s2.final_company_id, s3.final_company_id) as final_company_id,
        COALESCE(s1.neo_id, s2.neo_id, s3.neo_id, sl.neo_id, n.neoid) as neo_id,
        COALESCE(s1.masters, s2.masters, s3.masters, 0) as masters,
        COALESCE(s1.status, s2.status, s3.status, 'not_placed') as status,
        COALESCE(s1.topcoder, s2.topcoder, s3.topcoder, n.topcoder, 0) as topcoder
      FROM company_sl sl
      LEFT JOIN temp_neoid_table n ON (sl.neo_id IS NOT NULL AND n.neoid = sl.neo_id COLLATE NOCASE)
      LEFT JOIN temp_students s1 ON (sl.regno IS NOT NULL AND s1.regno = sl.regno COLLATE NOCASE)
      LEFT JOIN temp_students s2 ON (s1.regno IS NULL AND sl.neo_id IS NOT NULL AND sl.neo_id != '' AND s2.neo_id = sl.neo_id COLLATE NOCASE)
      LEFT JOIN temp_students s3 ON (s1.regno IS NULL AND s2.regno IS NULL AND n.regno IS NOT NULL AND s3.regno = n.regno COLLATE NOCASE)
      ORDER BY sl.round_number DESC,
        CASE
          WHEN LOWER(COALESCE(s1.campus, s2.campus, s3.campus, n.campus, 'Unknown')) LIKE '%chennai%' THEN 1
          WHEN LOWER(COALESCE(s1.campus, s2.campus, s3.campus, n.campus, 'Unknown')) LIKE '%vellore%' THEN 2
          ELSE 3
        END ASC,
        COALESCE(s1.topcoder, s2.topcoder, s3.topcoder, n.topcoder, 0) DESC,
        COALESCE(COALESCE(s1.cgpa, s2.cgpa, s3.cgpa), 0) DESC
    `).all(id);

    // Group by round
    const roundMap = new Map<number, {
      round_number: number; round_name: string; students: any[];
      chennai_count: number; unknown_count: number;
      min_cgpa?: number; avg_cgpa?: number; total_cgpa: number; cgpa_count: number;
      min_tenth?: number; avg_tenth?: number; total_tenth: number; tenth_count: number;
      min_twelfth?: number; avg_twelfth?: number; total_twelfth: number; twelfth_count: number;
      male_count: number; female_count: number;
    }>();
    for (const st of shortlisted as any[]) {
      const rNum = st.round_number || 1;
      const rName = st.round_name || `Shortlist ${rNum}`;
      if (!roundMap.has(rNum)) {
        roundMap.set(rNum, {
          round_number: rNum, round_name: rName, students: [],
          chennai_count: 0, unknown_count: 0,
          total_cgpa: 0, cgpa_count: 0, min_cgpa: Infinity,
          total_tenth: 0, tenth_count: 0, min_tenth: Infinity,
          total_twelfth: 0, twelfth_count: 0, min_twelfth: Infinity,
          male_count: 0, female_count: 0
        });
      } else {
        const existing = roundMap.get(rNum)!;
        if (rName && rName !== `Shortlist ${rNum}` && existing.round_name === `Shortlist ${rNum}`) {
          existing.round_name = rName;
        }
      }
      const rObj = roundMap.get(rNum)!;
      rObj.students.push(st);
      if (!st.campus || st.campus === 'Unknown') rObj.unknown_count++;
      else if (st.campus === 'Chennai' || st.campus.includes('Chennai')) rObj.chennai_count++;

      if (st.gender === 'Male') rObj.male_count++;
      else if (st.gender === 'Female') rObj.female_count++;

      if (typeof st.cgpa === 'number' && st.cgpa > 0) {
        rObj.cgpa_count++;
        rObj.total_cgpa += st.cgpa;
        if (st.cgpa < rObj.min_cgpa!) rObj.min_cgpa = st.cgpa;
      }

      if (typeof st.tenth_marks === 'number' && st.tenth_marks > 0) {
        rObj.tenth_count++;
        rObj.total_tenth += st.tenth_marks;
        if (st.tenth_marks < rObj.min_tenth!) rObj.min_tenth = st.tenth_marks;
      }

      if (typeof st.twelfth_marks === 'number' && st.twelfth_marks > 0) {
        rObj.twelfth_count++;
        rObj.total_twelfth += st.twelfth_marks;
        if (st.twelfth_marks < rObj.min_twelfth!) rObj.min_twelfth = st.twelfth_marks;
      }
    }

    // Post-process to calculate averages and handle Infinities
    for (const rObj of roundMap.values()) {
      if (rObj.cgpa_count > 0) rObj.avg_cgpa = rObj.total_cgpa / rObj.cgpa_count;
      else rObj.min_cgpa = undefined;

      if (rObj.tenth_count > 0) rObj.avg_tenth = rObj.total_tenth / rObj.tenth_count;
      else rObj.min_tenth = undefined;

      if (rObj.twelfth_count > 0) rObj.avg_twelfth = rObj.total_twelfth / rObj.twelfth_count;
      else rObj.min_twelfth = undefined;
    }
    const shortlist_rounds = Array.from(roundMap.values()).sort((a, b) => b.round_number - a.round_number);

    // Intern students (temp_interns_selected)
    const interns = db.prepare(`
      WITH company_sel AS (
        SELECT id, company_id, regno, neo_id, selected_at
        FROM temp_interns_selected
        WHERE company_id = ?
      )
      SELECT
        sel.id as selection_entry_id,
        sel.selected_at,
        'intern' as offer_type,
        COALESCE(s1.regno, s2.regno, s3.regno, sel.regno, n.regno) as regno,
        COALESCE(s1.name, s2.name, s3.name, CASE WHEN COALESCE(sel.neo_id, s1.neo_id, s2.neo_id, s3.neo_id, n.neoid) IS NOT NULL THEN 'Student (' || COALESCE(sel.neo_id, s1.neo_id, s2.neo_id, s3.neo_id, n.neoid) || ')' ELSE 'Student (' || COALESCE(sel.regno, 'Unmapped') || ')' END) as name,
        COALESCE(s1.email, s2.email, s3.email, '') as email,
        COALESCE(s1.phone, s2.phone, s3.phone) as phone,
        COALESCE(s1.personal_email, s2.personal_email, s3.personal_email) as personal_email,
        COALESCE(s1.gender, s2.gender, s3.gender) as gender,
        COALESCE(s1.cgpa, s2.cgpa, s3.cgpa) as cgpa,
        COALESCE(s1.tenth_marks, s2.tenth_marks, s3.tenth_marks) as tenth_marks,
        COALESCE(s1.twelfth_marks, s2.twelfth_marks, s3.twelfth_marks) as twelfth_marks,
        COALESCE(s1.resume_link, s2.resume_link, s3.resume_link) as resume_link,
        COALESCE(s1.branch, s2.branch, s3.branch, 'Unknown') as branch,
        COALESCE(s1.campus, s2.campus, s3.campus, n.campus, 'Chennai') as campus,
        COALESCE(s1.placed, s2.placed, s3.placed, 0) as placed,
        COALESCE(s1.final_company_id, s2.final_company_id, s3.final_company_id) as final_company_id,
        COALESCE(s1.neo_id, s2.neo_id, s3.neo_id, sel.neo_id, n.neoid) as neo_id,
        COALESCE(s1.masters, s2.masters, s3.masters, 0) as masters,
        COALESCE(s1.status, s2.status, s3.status, 'not_placed') as status,
        COALESCE(s1.topcoder, s2.topcoder, s3.topcoder, n.topcoder, 0) as topcoder
      FROM company_sel sel
      LEFT JOIN temp_neoid_table n ON (sel.neo_id IS NOT NULL AND n.neoid = sel.neo_id COLLATE NOCASE)
      LEFT JOIN temp_students s1 ON (sel.regno IS NOT NULL AND s1.regno = sel.regno COLLATE NOCASE)
      LEFT JOIN temp_students s2 ON (s1.regno IS NULL AND sel.neo_id IS NOT NULL AND sel.neo_id != '' AND s2.neo_id = sel.neo_id COLLATE NOCASE)
      LEFT JOIN temp_students s3 ON (s1.regno IS NULL AND s2.regno IS NULL AND n.regno IS NOT NULL AND s3.regno = n.regno COLLATE NOCASE)
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(s1.campus, s2.campus, s3.campus, n.campus, 'Unknown')) LIKE '%chennai%' THEN 1
          WHEN LOWER(COALESCE(s1.campus, s2.campus, s3.campus, n.campus, 'Unknown')) LIKE '%vellore%' THEN 2
          ELSE 3
        END ASC,
        COALESCE(s1.topcoder, s2.topcoder, s3.topcoder, n.topcoder, 0) DESC,
        COALESCE(COALESCE(s1.cgpa, s2.cgpa, s3.cgpa), 0) DESC
    `).all(id);

    // Finally placed students (temp_final_selection)
    const finals = db.prepare(`
      WITH company_fin AS (
        SELECT id, company_id, regno, neo_id, selected_at
        FROM temp_final_selection
        WHERE company_id = ?
      )
      SELECT
        fin.id as selection_entry_id,
        fin.selected_at,
        'placed' as offer_type,
        COALESCE(s1.regno, s2.regno, s3.regno, fin.regno, n.regno) as regno,
        COALESCE(s1.name, s2.name, s3.name, CASE WHEN COALESCE(fin.neo_id, s1.neo_id, s2.neo_id, s3.neo_id, n.neoid) IS NOT NULL THEN 'Student (' || COALESCE(fin.neo_id, s1.neo_id, s2.neo_id, s3.neo_id, n.neoid) || ')' ELSE 'Student (' || COALESCE(fin.regno, 'Unmapped') || ')' END) as name,
        COALESCE(s1.email, s2.email, s3.email, '') as email,
        COALESCE(s1.phone, s2.phone, s3.phone) as phone,
        COALESCE(s1.personal_email, s2.personal_email, s3.personal_email) as personal_email,
        COALESCE(s1.gender, s2.gender, s3.gender) as gender,
        COALESCE(s1.cgpa, s2.cgpa, s3.cgpa) as cgpa,
        COALESCE(s1.tenth_marks, s2.tenth_marks, s3.tenth_marks) as tenth_marks,
        COALESCE(s1.twelfth_marks, s2.twelfth_marks, s3.twelfth_marks) as twelfth_marks,
        COALESCE(s1.resume_link, s2.resume_link, s3.resume_link) as resume_link,
        COALESCE(s1.branch, s2.branch, s3.branch, 'Unknown') as branch,
        COALESCE(s1.campus, s2.campus, s3.campus, n.campus, 'Chennai') as campus,
        COALESCE(s1.placed, s2.placed, s3.placed, 0) as placed,
        COALESCE(s1.final_company_id, s2.final_company_id, s3.final_company_id) as final_company_id,
        COALESCE(s1.neo_id, s2.neo_id, s3.neo_id, fin.neo_id, n.neoid) as neo_id,
        COALESCE(s1.masters, s2.masters, s3.masters, 0) as masters,
        COALESCE(s1.status, s2.status, s3.status, 'not_placed') as status,
        COALESCE(s1.topcoder, s2.topcoder, s3.topcoder, n.topcoder, 0) as topcoder
      FROM company_fin fin
      LEFT JOIN temp_neoid_table n ON (fin.neo_id IS NOT NULL AND n.neoid = fin.neo_id COLLATE NOCASE)
      LEFT JOIN temp_students s1 ON (fin.regno IS NOT NULL AND s1.regno = fin.regno COLLATE NOCASE)
      LEFT JOIN temp_students s2 ON (s1.regno IS NULL AND fin.neo_id IS NOT NULL AND fin.neo_id != '' AND s2.neo_id = fin.neo_id COLLATE NOCASE)
      LEFT JOIN temp_students s3 ON (s1.regno IS NULL AND s2.regno IS NULL AND n.regno IS NOT NULL AND s3.regno = n.regno COLLATE NOCASE)
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(s1.campus, s2.campus, s3.campus, n.campus, 'Unknown')) LIKE '%chennai%' THEN 1
          WHEN LOWER(COALESCE(s1.campus, s2.campus, s3.campus, n.campus, 'Unknown')) LIKE '%vellore%' THEN 2
          ELSE 3
        END ASC,
        COALESCE(s1.topcoder, s2.topcoder, s3.topcoder, n.topcoder, 0) DESC,
        COALESCE(COALESCE(s1.cgpa, s2.cgpa, s3.cgpa), 0) DESC
    `).all(id);

    return c.json({ ...company, analytics, shortlisted, shortlist_rounds, interns, finals });
  } catch (err: any) {
    console.error('[GET /api/companies/:id] Error:', err);
    return c.json({ error: 'Internal server error', details: err?.message }, 500);
  }
});

// Create company
app.post('/api/companies', async (c) => {
  const body = await c.req.json();
  const {
    name, notes, rounds, ctc, total_rounds, round_details, experience_required,
    role, category, stipend, job_location, eligible_branches, eligibility_criteria, website
  } = body;
  
  try {
    const result = db.prepare(
      `INSERT INTO companies (
        name, notes, rounds, ctc, total_rounds, round_details, experience_required,
        role, category, stipend, job_location, eligible_branches, eligibility_criteria, website
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      name,
      notes || null,
      rounds ? parseInt(rounds) : (total_rounds ? parseInt(total_rounds) : null),
      ctc || null,
      total_rounds ? parseInt(total_rounds) : (rounds ? parseInt(rounds) : null),
      round_details || null,
      experience_required || null,
      role || null,
      category || null,
      stipend || null,
      job_location || null,
      eligible_branches || null,
      eligibility_criteria || null,
      website || null
    );
    
    // Initialize analytics
    db.prepare(
      'INSERT INTO company_analytics (company_id) VALUES (?)'
    ).run(result.lastInsertRowid);
    
    const created = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid);
    return c.json(created);
  } catch (error: any) {
    console.error('[POST /api/companies] Error:', error);
    if (error.message?.includes('UNIQUE constraint failed: companies.name')) {
      return c.json({ error: 'A company with this name already exists.' }, 400);
    }
    return c.json({ error: error.message }, 400);
  }
});

// Update company
app.put('/api/companies/:id', async (c) => {
  if (!verifyAdminPassword(c)) {
    return c.json({ error: 'Unauthorized: Invalid admin password' }, 401);
  }
  const id = c.req.param('id');
  const body = await c.req.json();
  const {
    name, notes, rounds, ctc, total_rounds, round_details, experience_required,
    role, category, stipend, job_location, eligible_branches, eligibility_criteria, website
  } = body;
  
  try {
    db.prepare(
      `UPDATE companies SET 
        name = ?, notes = ?, rounds = ?, ctc = ?, total_rounds = ?, round_details = ?, experience_required = ?,
        role = ?, category = ?, stipend = ?, job_location = ?, eligible_branches = ?, eligibility_criteria = ?, website = ?
      WHERE id = ?`
    ).run(
      name,
      notes || null,
      rounds ? parseInt(rounds) : (total_rounds ? parseInt(total_rounds) : null),
      ctc || null,
      total_rounds ? parseInt(total_rounds) : (rounds ? parseInt(rounds) : null),
      round_details || null,
      experience_required || null,
      role || null,
      category || null,
      stipend || null,
      job_location || null,
      eligible_branches || null,
      eligibility_criteria || null,
      website || null,
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

// Helper to resolve student by Register Number or Neo ID against temp tables
function resolveTempToken(token: string) {
  const clean = token.trim();
  if (!clean) return null;
  const upper = clean.toUpperCase();

  // 1. Direct match on temp_students (by regno or neo_id)
  let student = db.prepare(`
    SELECT regno, neo_id, name, branch, campus, placed, status, final_company_id
    FROM temp_students
    WHERE regno = ? COLLATE NOCASE OR neo_id = ? COLLATE NOCASE
  `).get(upper, upper) as any;

  if (student) {
    let neo_id = student.neo_id || null;
    if (!neo_id) {
      const neoRec = db.prepare('SELECT neoid FROM temp_neoid_table WHERE regno = ? COLLATE NOCASE').get(student.regno.toUpperCase()) as any;
      if (neoRec) neo_id = neoRec.neoid;
    }
    return {
      success: true,
      regno: student.regno,
      neo_id: neo_id,
      token: upper,
      studentName: student.name,
      foundIn: 'temp_students'
    };
  }

  // 2. Direct match on temp_neoid_table (by neoid or regno)
  const neoRecord = db.prepare(`
    SELECT neoid, regno, campus
    FROM temp_neoid_table
    WHERE neoid = ? COLLATE NOCASE OR regno = ? COLLATE NOCASE
  `).get(upper, upper) as any;

  if (neoRecord) {
    let regno = neoRecord.regno || null;
    if (regno) {
      // Verify if regno actually exists in temp_students to satisfy FK constraints
      const validStudent = db.prepare('SELECT regno FROM temp_students WHERE regno = ? COLLATE NOCASE').get(regno.toUpperCase());
      if (!validStudent) regno = null;
    } else {
      const studentRec = db.prepare('SELECT regno FROM temp_students WHERE neo_id = ? COLLATE NOCASE').get(neoRecord.neoid.toUpperCase()) as any;
      if (studentRec) regno = studentRec.regno;
    }
    return {
      success: true,
      regno: regno,
      neo_id: neoRecord.neoid,
      token: upper,
      foundIn: 'temp_neoid_table'
    };
  }

  // 3. Auto-insert unmatched NeoID into temp_neoid_table with campus = 'Unknown'
  if (/^[A-Z0-9_-]{4,25}$/i.test(upper)) {
    try {
      db.prepare(`
        INSERT INTO temp_neoid_table (neoid, campus)
        VALUES (?, 'Unknown')
        ON CONFLICT(neoid) DO NOTHING
      `).run(upper);

      return {
        success: true,
        regno: null,
        neo_id: upper,
        token: upper,
        foundIn: 'auto_registered_neoid'
      };
    } catch (e) {
      // Fallthrough to error response below if insert fails
    }
  }

  // 4. Not found in temp_students or temp_neoid_table -> Error
  return {
    success: false,
    token: upper,
    error: `Identifier '${upper}' not found in database (temp_students or temp_neoid_table).`
  };
}

// Add students to company shortlist (accepts RegNo or NeoID & round info)
app.post('/api/companies/:id/shortlist', async (c) => {
  try {
    const companyId = c.req.param('id');
    const body = await c.req.json();
    const rawInput = body.regnos || body.identifiers || [];
    const roundNumber = body.round_number ? parseInt(body.round_number) : 1;

    // Check if there is an existing custom round_name for this company and round_number
    let roundName = body.round_name ? String(body.round_name).trim() : '';
    if (!roundName) {
      const existingRound = db.prepare(`
        SELECT round_name FROM temp_shortlists
        WHERE company_id = ? AND round_number = ? AND round_name IS NOT NULL AND round_name != ''
        LIMIT 1
      `).get(companyId, roundNumber) as any;

      if (existingRound && existingRound.round_name) {
        roundName = existingRound.round_name;
      } else {
        roundName = `Shortlist ${roundNumber}`;
      }
    }

    const tokens = extractCleanTokens(rawInput);
    if (tokens.length === 0) {
      return c.json({ error: 'No valid registration numbers or Neo IDs provided' }, 400);
    }

    const results: any[] = [];
    const errors: any[] = [];

    const processShortlistBulk = db.transaction(() => {
      for (const item of tokens) {
        try {
          const resolved = resolveTempToken(item);
          if (!resolved || !resolved.success) {
            errors.push({
              identifier: item,
              error: resolved?.error || `Identifier '${item}' not found in database.`
            });
            continue;
          }

          // Duplicate check: Verify if student is already in this shortlist round
          const existing = db.prepare(`
            SELECT id FROM temp_shortlists
            WHERE company_id = ? AND round_number = ?
              AND (
                (? IS NOT NULL AND regno IS NOT NULL AND regno = ? COLLATE NOCASE)
                OR (? IS NOT NULL AND neo_id IS NOT NULL AND neo_id = ? COLLATE NOCASE)
              )
          `).get(companyId, roundNumber, resolved.regno || null, resolved.regno || null, resolved.neo_id || null, resolved.neo_id || null);

          if (existing) {
            results.push({
              identifier: resolved.token,
              regno: resolved.regno,
              neo_id: resolved.neo_id,
              round: roundName,
              success: true,
              isDuplicate: true,
              note: 'Already shortlisted for this round'
            });
            continue;
          }

          const insertResult = db.prepare(`
            INSERT OR IGNORE INTO temp_shortlists (regno, neo_id, company_id, round_number, round_name)
            VALUES (?, ?, ?, ?, ?)
          `).run(resolved.regno || null, resolved.neo_id || null, companyId, roundNumber, roundName);

          if (insertResult.changes > 0) {
            results.push({ identifier: resolved.token, regno: resolved.regno, neo_id: resolved.neo_id, round: roundName, success: true });
          } else {
            results.push({ identifier: resolved.token, regno: resolved.regno, neo_id: resolved.neo_id, round: roundName, success: true, note: 'Already shortlisted for this round' });
          }
        } catch (error: any) {
          errors.push({ identifier: item, error: error.message });
        }
      }
    });

    processShortlistBulk();

    setTimeout(() => {
      try {
        updateCompanyAnalytics(parseInt(companyId));
        cachedAnalyticsSummary = null;
      } catch (err) {
        console.error('Background analytics error:', err);
      }
    }, 0);

    return c.json({ results, errors, round_number: roundNumber, round_name: roundName });
  } catch (error: any) {
    console.error('Error in shortlist endpoint:', error);
    return c.json({ error: 'Internal server error', details: error.message }, 500);
  }
});

// Update shortlist round name for a company
app.put('/api/companies/:id/shortlist-round/:roundNumber', async (c) => {
  if (!verifyAdminPassword(c)) {
    return c.json({ error: 'Unauthorized: Invalid admin password' }, 401);
  }
  try {
    const companyId = c.req.param('id');
    const roundNumber = parseInt(c.req.param('roundNumber'));
    const body = await c.req.json();
    const roundName = body.round_name ? String(body.round_name).trim() : '';

    if (!roundName) {
      return c.json({ error: 'Custom shortlist round name is required' }, 400);
    }

    const result = db.prepare(`
      UPDATE temp_shortlists
      SET round_name = ?
      WHERE company_id = ? AND round_number = ?
    `).run(roundName, companyId, roundNumber);

    return c.json({ success: true, updatedCount: result.changes, round_number: roundNumber, round_name: roundName });
  } catch (error: any) {
    console.error('Error renaming shortlist round:', error);
    return c.json({ error: 'Internal server error', details: error.message }, 500);
  }
});

// Delete a shortlist round for a company
app.delete('/api/companies/:id/shortlist-round/:roundNumber', async (c) => {
  if (!verifyAdminPassword(c)) {
    return c.json({ error: 'Unauthorized: Invalid admin password' }, 401);
  }
  try {
    const companyId = c.req.param('id');
    const roundNumber = parseInt(c.req.param('roundNumber'));

    const result = db.prepare(`
      DELETE FROM temp_shortlists
      WHERE company_id = ? AND round_number = ?
    `).run(companyId, roundNumber);

    updateCompanyAnalytics(parseInt(companyId));
    cachedAnalyticsSummary = null;

    return c.json({ success: true, deletedCount: result.changes });
  } catch (error: any) {
    console.error('Error deleting shortlist round:', error);
    return c.json({ error: 'Internal server error', details: error.message }, 500);
  }
});

// Add students to company selections (final selection, accepts RegNo or NeoID)
app.post('/api/companies/:id/selections', async (c) => {
  try {
    const companyId = c.req.param('id');
    const body = await c.req.json();
    const rawInput = body.regnos || body.identifiers || [];
    const selectionStatus = body.status === 'intern' ? 'intern' : 'placed';

    const tokens = extractCleanTokens(rawInput);
    if (tokens.length === 0) {
      return c.json({ error: 'No valid registration numbers or Neo IDs provided' }, 400);
    }

    const results: any[] = [];
    const errors: any[] = [];

    const processSelectionBulk = db.transaction(() => {
      for (const item of tokens) {
        try {
          const resolved = resolveTempToken(item);
          if (!resolved || !resolved.success) {
            errors.push({
              identifier: item,
              error: resolved?.error || `Identifier '${item}' not found in database.`
            });
            continue;
          }

          let insertResult;
          if (selectionStatus === 'placed') {
            insertResult = db.prepare(`
              INSERT OR IGNORE INTO temp_final_selection (regno, neo_id, company_id)
              VALUES (?, ?, ?)
            `).run(resolved.regno || null, resolved.neo_id || null, companyId);
          } else {
            insertResult = db.prepare(`
              INSERT OR IGNORE INTO temp_interns_selected (regno, neo_id, company_id)
              VALUES (?, ?, ?)
            `).run(resolved.regno || null, resolved.neo_id || null, companyId);
          }

          // Update temp_students status
          if (resolved.regno) {
            db.prepare(`
              UPDATE temp_students
              SET placed = 1, status = ?, final_company_id = ?
              WHERE UPPER(regno) = UPPER(?)
            `).run(selectionStatus, companyId, resolved.regno);
          }
          if (resolved.neo_id) {
            db.prepare(`
              UPDATE temp_students
              SET placed = 1, status = ?, final_company_id = ?
              WHERE neo_id IS NOT NULL AND UPPER(neo_id) = UPPER(?)
            `).run(selectionStatus, companyId, resolved.neo_id);
          }

          if (insertResult.changes > 0) {
            results.push({ identifier: resolved.token, regno: resolved.regno, neo_id: resolved.neo_id, success: true });
          } else {
            results.push({ identifier: resolved.token, regno: resolved.regno, neo_id: resolved.neo_id, success: true, note: 'Already selected' });
          }
        } catch (error: any) {
          errors.push({ identifier: item, error: error.message });
        }
      }
    });

    processSelectionBulk();

    setTimeout(() => {
      try {
        updateCompanyAnalytics(parseInt(companyId));
        cachedAnalyticsSummary = null;
      } catch (err) {
        console.error('Background analytics error:', err);
      }
    }, 0);

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
      'UPDATE temp_students SET placed = 1, final_company_id = ? WHERE UPPER(regno) = UPPER(?) OR UPPER(neo_id) = UPPER(?)'
    ).run(companyId, studentId, studentId);
    
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
// ---------------------------------------------------------------------------
// In-Memory Caching for Analytics Summary
// ---------------------------------------------------------------------------
let cachedAnalyticsSummary: any = null;

function computeAnalyticsSummary() {
  const totalStudentsRow = db.prepare('SELECT COUNT(*) as count FROM temp_students').get() as { count: number };
  const totalStudents = totalStudentsRow?.count || 0;

  const totalNeoIdsRow = db.prepare('SELECT COUNT(*) as count FROM temp_neoid_table').get() as { count: number };
  const totalNeoIds = totalNeoIdsRow?.count || 0;

  const totalCompaniesRow = db.prepare('SELECT COUNT(*) as count FROM companies').get() as { count: number };
  const totalCompanies = totalCompaniesRow?.count || 0;

  // 1. Final Placement Analytics (from temp_final_selection ONLY)
  const totalPlacedRow = db.prepare(`
    SELECT COUNT(DISTINCT COALESCE(s.regno, fin.regno, fin.neo_id)) as count
    FROM temp_final_selection fin
    LEFT JOIN temp_students s ON (s.regno = fin.regno OR (fin.neo_id IS NOT NULL AND fin.neo_id != '' AND s.neo_id = fin.neo_id))
  `).get() as { count: number };
  const totalPlaced = totalPlacedRow?.count || 0;

  const finalBranchStats = db.prepare(`
    SELECT s.branch, COUNT(DISTINCT s.regno) as total,
      COUNT(DISTINCT fin_sub.student_id) as placed
    FROM temp_students s
    LEFT JOIN (
      SELECT DISTINCT s2.regno as student_id
      FROM temp_students s2
      JOIN temp_final_selection fin ON (s2.regno = fin.regno OR (fin.neo_id IS NOT NULL AND fin.neo_id != '' AND s2.neo_id = fin.neo_id))
    ) fin_sub ON s.regno = fin_sub.student_id
    GROUP BY s.branch
    ORDER BY total DESC
  `).all();

  const finalCampusStats = db.prepare(`
    SELECT s.campus, COUNT(DISTINCT s.regno) as total,
      COUNT(DISTINCT fin_sub.student_id) as placed
    FROM temp_students s
    LEFT JOIN (
      SELECT DISTINCT s2.regno as student_id
      FROM temp_students s2
      JOIN temp_final_selection fin ON (s2.regno = fin.regno OR (fin.neo_id IS NOT NULL AND fin.neo_id != '' AND s2.neo_id = fin.neo_id))
    ) fin_sub ON s.regno = fin_sub.student_id
    GROUP BY s.campus
    ORDER BY total DESC
  `).all();

  // All companies with at least 1 final placement offer (broken down by campus)
  const finalCompaniesBreakdown = db.prepare(`
    SELECT 
      c.id,
      c.name,
      c.ctc,
      COUNT(DISTINCT CASE WHEN COALESCE(s.campus, n.campus) LIKE '%Chennai%' THEN COALESCE(s.regno, fin.regno, fin.neo_id) END) as chennai,
      COUNT(DISTINCT CASE WHEN COALESCE(s.campus, n.campus) LIKE '%Vellore%' THEN COALESCE(s.regno, fin.regno, fin.neo_id) END) as vellore,
      COUNT(DISTINCT CASE WHEN COALESCE(s.campus, n.campus) NOT LIKE '%Chennai%' AND COALESCE(s.campus, n.campus) NOT LIKE '%Vellore%' THEN COALESCE(s.regno, fin.regno, fin.neo_id) END) as unknown,
      COUNT(DISTINCT COALESCE(s.regno, fin.regno, fin.neo_id)) as total
    FROM companies c
    JOIN temp_final_selection fin ON c.id = fin.company_id
    LEFT JOIN temp_students s ON (s.regno = fin.regno OR (fin.neo_id IS NOT NULL AND fin.neo_id != '' AND s.neo_id = fin.neo_id))
    LEFT JOIN temp_neoid_table n ON (n.neoid = fin.neo_id OR (fin.regno IS NOT NULL AND fin.regno != '' AND n.regno = fin.regno))
    GROUP BY c.id, c.name
    HAVING total > 0
    ORDER BY total DESC, c.name ASC
  `).all();

  // 2. Intern Analytics (from temp_interns_selected ONLY)
  const totalInternsRow = db.prepare(`
    SELECT COUNT(DISTINCT COALESCE(s.regno, sel.regno, sel.neo_id)) as count
    FROM temp_interns_selected sel
    LEFT JOIN temp_students s ON (s.regno = sel.regno OR (sel.neo_id IS NOT NULL AND sel.neo_id != '' AND s.neo_id = sel.neo_id))
  `).get() as { count: number };
  const totalInterns = totalInternsRow?.count || 0;

  const internBranchStats = db.prepare(`
    SELECT s.branch, COUNT(DISTINCT s.regno) as total,
      COUNT(DISTINCT sel_sub.student_id) as interned
    FROM temp_students s
    LEFT JOIN (
      SELECT DISTINCT s2.regno as student_id
      FROM temp_students s2
      JOIN temp_interns_selected sel ON (s2.regno = sel.regno OR (sel.neo_id IS NOT NULL AND sel.neo_id != '' AND s2.neo_id = sel.neo_id))
    ) sel_sub ON s.regno = sel_sub.student_id
    GROUP BY s.branch
    ORDER BY total DESC
  `).all();

  const internCampusStats = db.prepare(`
    SELECT s.campus, COUNT(DISTINCT s.regno) as total,
      COUNT(DISTINCT sel_sub.student_id) as interned
    FROM temp_students s
    LEFT JOIN (
      SELECT DISTINCT s2.regno as student_id
      FROM temp_students s2
      JOIN temp_interns_selected sel ON (s2.regno = sel.regno OR (sel.neo_id IS NOT NULL AND sel.neo_id != '' AND s2.neo_id = sel.neo_id))
    ) sel_sub ON s.regno = sel_sub.student_id
    GROUP BY s.campus
    ORDER BY total DESC
  `).all();

  // All companies with at least 1 intern offer (broken down by campus)
  const internCompaniesBreakdown = db.prepare(`
    SELECT 
      c.id,
      c.name,
      c.ctc,
      COUNT(DISTINCT CASE WHEN COALESCE(s.campus, n.campus) LIKE '%Chennai%' THEN COALESCE(s.regno, sel.regno, sel.neo_id) END) as chennai,
      COUNT(DISTINCT CASE WHEN COALESCE(s.campus, n.campus) LIKE '%Vellore%' THEN COALESCE(s.regno, sel.regno, sel.neo_id) END) as vellore,
      COUNT(DISTINCT CASE WHEN COALESCE(s.campus, n.campus) NOT LIKE '%Chennai%' AND COALESCE(s.campus, n.campus) NOT LIKE '%Vellore%' THEN COALESCE(s.regno, sel.regno, sel.neo_id) END) as unknown,
      COUNT(DISTINCT COALESCE(s.regno, sel.regno, sel.neo_id)) as total
    FROM companies c
    JOIN temp_interns_selected sel ON c.id = sel.company_id
    LEFT JOIN temp_students s ON (s.regno = sel.regno OR (sel.neo_id IS NOT NULL AND sel.neo_id != '' AND s.neo_id = sel.neo_id))
    LEFT JOIN temp_neoid_table n ON (n.neoid = sel.neo_id OR (sel.regno IS NOT NULL AND sel.regno != '' AND n.regno = sel.regno))
    GROUP BY c.id, c.name
    HAVING total > 0
    ORDER BY total DESC, c.name ASC
  `).all();

  // 3. NeoID Campus Placement Metrics (from temp_neoid_table)
  const neoIdCampusRows = db.prepare(`
    SELECT 
      CASE 
        WHEN COALESCE(s.campus, n.campus) LIKE '%Chennai%' THEN 'Chennai'
        WHEN COALESCE(s.campus, n.campus) LIKE '%Vellore%' THEN 'Vellore'
        ELSE 'Unknown'
      END as campus,
      COUNT(DISTINCT n.neoid) as total,
      COUNT(DISTINCT CASE WHEN fin.id IS NOT NULL THEN n.neoid END) as placed,
      COUNT(DISTINCT CASE WHEN sel.id IS NOT NULL THEN n.neoid END) as interned
    FROM temp_neoid_table n
    LEFT JOIN temp_students s ON (s.neo_id = n.neoid OR (n.regno IS NOT NULL AND n.regno != '' AND s.regno = n.regno))
    LEFT JOIN temp_final_selection fin ON (fin.neo_id = n.neoid OR (fin.regno IS NOT NULL AND fin.regno != '' AND (fin.regno = s.regno OR fin.regno = n.regno)))
    LEFT JOIN temp_interns_selected sel ON (sel.neo_id = n.neoid OR (sel.regno IS NOT NULL AND sel.regno != '' AND (sel.regno = s.regno OR sel.regno = n.regno)))
    GROUP BY 1
    ORDER BY total DESC
  `).all() as Array<{ campus: string; total: number; placed: number; interned: number }>;

  // Ensure all 3 categories (Chennai, Vellore, Unknown) exist in breakdown
  const campusMap = new Map<string, { total: number; placed: number; interned: number }>();
  campusMap.set('Chennai', { total: 0, placed: 0, interned: 0 });
  campusMap.set('Vellore', { total: 0, placed: 0, interned: 0 });
  campusMap.set('Unknown', { total: 0, placed: 0, interned: 0 });

  for (const row of neoIdCampusRows) {
    if (campusMap.has(row.campus)) {
      const existing = campusMap.get(row.campus)!;
      existing.total += row.total;
      existing.placed += row.placed;
      existing.interned += row.interned;
    } else {
      const unk = campusMap.get('Unknown')!;
      unk.total += row.total;
      unk.placed += row.placed;
      unk.interned += row.interned;
    }
  }

  let totalNeoIdPlaced = 0;
  const neoIdCampusStats = Array.from(campusMap.entries()).map(([campus, stats]) => {
    totalNeoIdPlaced += stats.placed;
    return {
      campus,
      total: stats.total,
      placed: stats.placed,
      placedRate: stats.total > 0 ? ((stats.placed / stats.total) * 100).toFixed(2) : '0.00',
      interned: stats.interned,
      internedRate: stats.total > 0 ? ((stats.interned / stats.total) * 100).toFixed(2) : '0.00'
    };
  });

  const chennaiStats = campusMap.get('Chennai') || { total: 0, placed: 0, interned: 0 };
  const chennaiNeoIdPlacementRate = chennaiStats.total > 0
    ? ((chennaiStats.placed / chennaiStats.total) * 100).toFixed(2)
    : '0.00';

  return {
    totalStudents,
    totalNeoIds,
    totalPlacedNeoIds: totalNeoIdPlaced,
    overallNeoIdPlacementRate: totalNeoIds > 0 ? ((totalNeoIdPlaced / totalNeoIds) * 100).toFixed(2) : '0.00',
    chennaiNeoIdStats: {
      total: chennaiStats.total,
      placed: chennaiStats.placed,
      rate: chennaiNeoIdPlacementRate
    },
    totalCompanies,

    // Final Placement Analytics (placed metrics)
    finalPlacement: {
      totalPlaced,
      placementRate: totalStudents > 0 ? ((totalPlaced / totalStudents) * 100).toFixed(2) : '0.00',
      branchStats: finalBranchStats,
      campusStats: finalCampusStats,
      companiesBreakdown: finalCompaniesBreakdown
    },

    // Intern Selection Analytics (intern metrics)
    internAnalytics: {
      totalInterns,
      internRate: totalStudents > 0 ? ((totalInterns / totalStudents) * 100).toFixed(2) : '0.00',
      branchStats: internBranchStats,
      campusStats: internCampusStats,
      companiesBreakdown: internCompaniesBreakdown
    },

    // NeoID Campus Placement Breakdown
    neoIdCampusStats
  };
}

// ---------------------------------------------------------------------------
// GET /api/analytics/summary
// ---------------------------------------------------------------------------
app.get('/api/analytics/summary', (c) => {
  const recalculate = c.req.query('recalculate') === 'true';
  if (recalculate || !cachedAnalyticsSummary) {
    cachedAnalyticsSummary = computeAnalyticsSummary();
  }
  return c.json(cachedAnalyticsSummary);
});

function updateCompanyAnalytics(companyId: number) {
  // Get shortlist statistics from active temp tables
  const shortlistStats = db.prepare(`
    SELECT 
      MIN(s.cgpa) as min_cgpa,
      AVG(s.cgpa) as avg_cgpa,
      MIN(s.tenth_marks) as min_tenth,
      AVG(s.tenth_marks) as avg_tenth,
      MIN(s.twelfth_marks) as min_twelfth,
      AVG(s.twelfth_marks) as avg_twelfth,
      COUNT(DISTINCT COALESCE(s.regno, sl.regno, sl.neo_id)) as total_shortlisted,
      COUNT(DISTINCT CASE WHEN s.gender = 'Male' THEN COALESCE(s.regno, sl.regno, sl.neo_id) END) as male_count,
      COUNT(DISTINCT CASE WHEN s.gender = 'Female' THEN COALESCE(s.regno, sl.regno, sl.neo_id) END) as female_count
    FROM temp_shortlists sl
    LEFT JOIN temp_neoid_table n ON (sl.neo_id IS NOT NULL AND n.neoid = sl.neo_id COLLATE NOCASE)
    LEFT JOIN temp_students s ON (
      (sl.regno IS NOT NULL AND s.regno = sl.regno COLLATE NOCASE)
      OR (sl.neo_id IS NOT NULL AND sl.neo_id != '' AND s.neo_id = sl.neo_id COLLATE NOCASE)
      OR (n.regno IS NOT NULL AND s.regno = n.regno COLLATE NOCASE)
    )
    WHERE sl.company_id = ?
  `).get(companyId) as any;
  
  // Get selection statistics from active temp tables (final selections + intern selections)
  const selectionStats = db.prepare(`
    SELECT 
      MIN(s.cgpa) as min_cgpa,
      AVG(s.cgpa) as avg_cgpa,
      MIN(s.tenth_marks) as min_tenth,
      AVG(s.tenth_marks) as avg_tenth,
      MIN(s.twelfth_marks) as min_twelfth,
      AVG(s.twelfth_marks) as avg_twelfth,
      COUNT(DISTINCT COALESCE(s.regno, sel.regno, sel.neo_id)) as total_selected,
      COUNT(DISTINCT CASE WHEN s.gender = 'Male' THEN COALESCE(s.regno, sel.regno, sel.neo_id) END) as male_count,
      COUNT(DISTINCT CASE WHEN s.gender = 'Female' THEN COALESCE(s.regno, sel.regno, sel.neo_id) END) as female_count
    FROM (
      SELECT regno, neo_id, company_id FROM temp_final_selection WHERE company_id = ?
      UNION
      SELECT regno, neo_id, company_id FROM temp_interns_selected WHERE company_id = ?
    ) sel
    LEFT JOIN temp_neoid_table n ON (sel.neo_id IS NOT NULL AND n.neoid = sel.neo_id COLLATE NOCASE)
    LEFT JOIN temp_students s ON (
      (sel.regno IS NOT NULL AND s.regno = sel.regno COLLATE NOCASE)
      OR (sel.neo_id IS NOT NULL AND sel.neo_id != '' AND s.neo_id = sel.neo_id COLLATE NOCASE)
      OR (n.regno IS NOT NULL AND s.regno = n.regno COLLATE NOCASE)
    )
  `).get(companyId, companyId) as any;
  
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
