import db from '../db/database.js';
import { fuzzyScore, FUZZY_THRESHOLD } from '../utils/fuzzy.utils.js';
import { RolesService } from './roles.service.js';
import { AnalyticsService } from './analytics.service.js';

export interface GetStudentsParams {
  search?: string;
  page?: number;
  limit?: number;
  sortByShortlists?: boolean;
  unmappedChennai?: boolean;
  masters?: boolean;
  sort?: string;
}

export class StudentsService {
  static getStudents(params: GetStudentsParams) {
    const search = params.search?.trim() || '';
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 50));
    const unmappedChennai = !!params.unmappedChennai;
    const mastersFilter = !!params.masters;

    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const sqlParams: any[] = [];

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
      sqlParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total matching
    const countSql = `SELECT COUNT(*) as count FROM temp_students s ${whereClause}`;
    const totalRow = db.prepare(countSql).get(...sqlParams) as { count: number } | undefined;
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

    const sortParam = params.sort || (params.sortByShortlists ? 'shortlists' : 'default');

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

    const students = db.prepare(dataSql).all(...sqlParams, limit, offset);

    return {
      students,
      totalCount,
      unmappedChennaiCount,
      mastersCount,
      page,
      limit,
      totalPages
    };
  }

  static getStudentsByShortlists() {
    const students = db.prepare(`
      SELECT s.*, 
        COUNT(sl.id) as shortlist_count
      FROM temp_students s
      LEFT JOIN temp_shortlists sl ON (s.regno = sl.regno OR (sl.neo_id IS NOT NULL AND sl.neo_id != '' AND s.neo_id = sl.neo_id))
      GROUP BY s.regno
      ORDER BY shortlist_count DESC, s.name ASC
      LIMIT 50
    `).all();

    return {
      students,
      totalCount: students.length,
      page: 1,
      limit: 50,
      totalPages: 1
    };
  }

  static searchStudentByRegno(regnoParam: string) {
    const regno = regnoParam.toUpperCase();
    return db.prepare('SELECT * FROM temp_students WHERE UPPER(regno) = ? OR UPPER(neo_id) = ?').get(regno, regno);
  }

  static getStudentDetails(identifier: string) {
    const param = identifier.trim().toUpperCase();

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
      return null;
    }

    const lookupRegno = student.regno ? student.regno.toUpperCase() : null;
    const lookupNeoid = student.neo_id ? student.neo_id.toUpperCase() : (param !== lookupRegno ? param : null);

    // Get shortlisted companies
    const shortlists = db.prepare(`
      SELECT co.*, sl.shortlisted_at, sl.round_number, sl.round_name, sl.role as shortlist_role, sl.role
      FROM companies co
      JOIN temp_shortlists sl ON co.id = sl.company_id
      WHERE (sl.regno IS NOT NULL AND UPPER(sl.regno) = ?)
         OR (sl.neo_id IS NOT NULL AND sl.neo_id != '' AND UPPER(sl.neo_id) = ?)
         OR (? IS NOT NULL AND UPPER(sl.neo_id) = ?)
      ORDER BY sl.round_number ASC, sl.shortlisted_at DESC
    `).all(lookupRegno || '', lookupNeoid || '', lookupNeoid || '', lookupNeoid || '');

    // Get intern selections
    const internSelections = db.prepare(`
      SELECT co.*, sel.selected_at, sel.role as selection_role, sel.role, 'intern' as offer_type
      FROM companies co
      JOIN temp_interns_selected sel ON co.id = sel.company_id
      WHERE (sel.regno IS NOT NULL AND UPPER(sel.regno) = ?)
         OR (sel.neo_id IS NOT NULL AND sel.neo_id != '' AND UPPER(sel.neo_id) = ?)
         OR (? IS NOT NULL AND UPPER(sel.neo_id) = ?)
      ORDER BY sel.selected_at DESC
    `).all(lookupRegno || '', lookupNeoid || '', lookupNeoid || '', lookupNeoid || '');

    // Get final placements
    const finalSelections = db.prepare(`
      SELECT co.*, fin.selected_at, fin.role as selection_role, fin.role, 'placed' as offer_type
      FROM companies co
      JOIN temp_final_selection fin ON co.id = fin.company_id
      WHERE (fin.regno IS NOT NULL AND UPPER(fin.regno) = ?)
         OR (fin.neo_id IS NOT NULL AND fin.neo_id != '' AND UPPER(fin.neo_id) = ?)
         OR (? IS NOT NULL AND UPPER(fin.neo_id) = ?)
      ORDER BY fin.selected_at DESC
    `).all(lookupRegno || '', lookupNeoid || '', lookupNeoid || '', lookupNeoid || '');

    const selections = [...internSelections, ...finalSelections];

    // Get final company details
    let finalCompany = null;
    if (student.final_company_id) {
      finalCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get(student.final_company_id);
    }

    return { ...student, shortlists, selections, finalCompany };
  }

  static updateStudent(identifier: string, body: any) {
    const param = identifier.trim().toUpperCase();

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
      topcoder,
      role
    } = body;

    const targetRegno = existing?.regno || regno || param;

    if (!name || !email) {
      throw new Error('Name and Email are required');
    }

    if (!status) {
      if (masters) status = 'masters';
      else if (placed) status = 'placed';
      else status = 'not_placed';
    }

    const isPlaced = status === 'placed' || status === 'intern';
    const isMasters = status === 'masters';
    const isTopcoder = topcoder ? 1 : 0;
    const cleanRole = role ? String(role).trim() : null;
    if (cleanRole) RolesService.ensureRoleExists(cleanRole);

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
            topcoder = ?,
            role = ?
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
        cleanRole,
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

    AnalyticsService.invalidateCache();

    return db.prepare(
      'SELECT * FROM temp_students WHERE UPPER(regno) = ?'
    ).get(targetRegno.toUpperCase());
  }

  static batchLookupNames(names: string[]) {
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

    return results;
  }

  static recalculateStudentAnalytics() {
    // 0. Auto-insert any unmatched NeoIDs from shortlists, selections, and students into temp_neoid_table with campus = 'Unknown'
    db.prepare(`
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

    // 1.5 Remove masters flag/status for any student who has a NeoID (they are in placement pool)
    const removeMastersResult = db.prepare(`
      UPDATE temp_students
      SET masters = 0,
          status = CASE WHEN status = 'masters' THEN 'not_placed' ELSE status END
      WHERE neo_id IS NOT NULL AND TRIM(neo_id) != '' AND (masters = 1 OR status = 'masters');
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
          ),
          role = (
            SELECT fin.role FROM temp_final_selection fin
            WHERE (UPPER(fin.regno) = UPPER(temp_students.regno)
               OR (fin.neo_id IS NOT NULL AND fin.neo_id != '' AND UPPER(fin.neo_id) = UPPER(temp_students.neo_id)))
               AND fin.role IS NOT NULL AND fin.role != ''
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
          ),
          role = (
            SELECT sel.role FROM temp_interns_selected sel
            WHERE (UPPER(sel.regno) = UPPER(temp_students.regno)
               OR (sel.neo_id IS NOT NULL AND sel.neo_id != '' AND UPPER(sel.neo_id) = UPPER(temp_students.neo_id)))
               AND sel.role IS NOT NULL AND sel.role != ''
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
          final_company_id = NULL,
          role = NULL
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

    AnalyticsService.invalidateCache();

    return {
      updatedNeoIds: syncNeoIdsResult.changes,
      updatedFinalPlacements: syncFinalsResult.changes,
      updatedInterns: syncInternsResult.changes,
      resetStaleCandidates: resetStaleResult.changes
    };
  }

  static placeStudent(studentId: string, companyId: number, roleInput?: string) {
    const cleanRole = roleInput ? String(roleInput).trim() : null;
    if (cleanRole) RolesService.ensureRoleExists(cleanRole);

    const result = db.prepare(
      'UPDATE temp_students SET placed = 1, final_company_id = ?, role = COALESCE(?, role) WHERE UPPER(regno) = UPPER(?) OR UPPER(neo_id) = UPPER(?)'
    ).run(companyId, cleanRole, studentId, studentId);

    AnalyticsService.invalidateCache();
    return result;
  }
}
