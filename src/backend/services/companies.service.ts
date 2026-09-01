import db from '../db/database.js';
import type { Company } from '../models/types.js';
import { extractCleanTokens } from '../utils/string.utils.js';
import { RolesService } from './roles.service.js';
import { NeoIdsService } from './neoIds.service.js';
import { AnalyticsService } from './analytics.service.js';

export class CompaniesService {
  static getAll() {
    return db.prepare(`
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
  }

  static getShortlistRounds(companyId: string | number) {
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
    `).all(companyId) as any[];

    const latestRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;

    return {
      rounds,
      latestRound,
      suggestedNextRoundNumber: latestRound ? (latestRound.round_number + 1) : 1
    };
  }

  static getCompanyDetails(id: string | number) {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as Company | undefined;
    if (!company) return null;

    const analytics = db.prepare('SELECT * FROM company_analytics WHERE company_id = ?').get(id);

    // Shortlisted students — Optimized prioritized LEFT JOINs with NOCASE indexes
    const shortlisted = db.prepare(`
      WITH company_sl AS (
        SELECT id, company_id, regno, neo_id, round_number, round_name, role, shortlisted_at
        FROM temp_shortlists
        WHERE company_id = ?
      )
      SELECT
        sl.id as shortlist_entry_id,
        sl.shortlisted_at,
        sl.round_number,
        sl.round_name,
        sl.role,
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
        SELECT id, company_id, regno, neo_id, role, selected_at
        FROM temp_interns_selected
        WHERE company_id = ?
      )
      SELECT
        sel.id as selection_entry_id,
        sel.selected_at,
        sel.role,
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
        SELECT id, company_id, regno, neo_id, role, selected_at
        FROM temp_final_selection
        WHERE company_id = ?
      )
      SELECT
        fin.id as selection_entry_id,
        fin.selected_at,
        fin.role,
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

    return { ...company, analytics, shortlisted, shortlist_rounds, interns, finals };
  }

  static create(body: any) {
    const {
      name, notes, rounds, ctc, total_rounds, round_details, experience_required,
      role, category, stipend, job_location, eligible_branches, eligibility_criteria, website
    } = body;

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
    db.prepare('INSERT INTO company_analytics (company_id) VALUES (?)').run(result.lastInsertRowid);

    AnalyticsService.invalidateCache();
    return db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid) as Company;
  }

  static update(id: string | number, body: any) {
    const {
      name, notes, rounds, ctc, total_rounds, round_details, experience_required,
      role, category, stipend, job_location, eligible_branches, eligibility_criteria, website
    } = body;

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

    AnalyticsService.invalidateCache();
    return db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as Company;
  }

  static delete(id: string | number) {
    const companyId = typeof id === 'string' ? parseInt(id, 10) : id;
    const company: any = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
    if (!company) {
      return null;
    }

    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM temp_shortlists WHERE company_id = ?').run(companyId);
      db.prepare('DELETE FROM temp_interns_selected WHERE company_id = ?').run(companyId);
      db.prepare('DELETE FROM temp_final_selection WHERE company_id = ?').run(companyId);
      db.prepare('DELETE FROM shortlists WHERE company_id = ?').run(companyId);
      db.prepare('DELETE FROM selections WHERE company_id = ?').run(companyId);
      db.prepare('DELETE FROM company_analytics WHERE company_id = ?').run(companyId);
      db.prepare('UPDATE students SET final_company_id = NULL WHERE final_company_id = ?').run(companyId);
      db.prepare('DELETE FROM companies WHERE id = ?').run(companyId);
    });

    deleteTransaction();
    AnalyticsService.invalidateCache();
    return company;
  }

  static addShortlist(companyId: string | number, rawInput: any, roundNum: any, roundNameInput?: string, roleInput?: string) {
    const roundNumber = roundNum ? parseInt(roundNum) : 1;
    const role = roleInput ? String(roleInput).trim() : null;
    if (role) RolesService.ensureRoleExists(role);

    let roundName = roundNameInput ? String(roundNameInput).trim() : '';
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
      throw new Error('No valid registration numbers or Neo IDs provided');
    }

    const results: any[] = [];
    const errors: any[] = [];

    const processShortlistBulk = db.transaction(() => {
      for (const item of tokens) {
        try {
          const resolved = NeoIdsService.resolveTempToken(item);
          if (!resolved || !resolved.success) {
            errors.push({
              identifier: item,
              error: resolved?.error || `Identifier '${item}' not found in database.`
            });
            continue;
          }

          // Duplicate check
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
              role: role,
              success: true,
              isDuplicate: true,
              note: 'Already shortlisted for this round'
            });
            continue;
          }

          const insertResult = db.prepare(`
            INSERT OR IGNORE INTO temp_shortlists (regno, neo_id, company_id, round_number, round_name, role)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(resolved.regno || null, resolved.neo_id || null, companyId, roundNumber, roundName, role || null);

          if (insertResult.changes > 0) {
            results.push({ identifier: resolved.token, regno: resolved.regno, neo_id: resolved.neo_id, round: roundName, role: role, success: true });
          } else {
            results.push({ identifier: resolved.token, regno: resolved.regno, neo_id: resolved.neo_id, round: roundName, role: role, success: true, note: 'Already shortlisted for this round' });
          }
        } catch (error: any) {
          errors.push({ identifier: item, error: error.message });
        }
      }
    });

    processShortlistBulk();

    setTimeout(() => {
      try {
        this.updateCompanyAnalytics(Number(companyId));
        AnalyticsService.invalidateCache();
      } catch (err) {
        console.error('Background analytics error:', err);
      }
    }, 0);

    return { results, errors, round_number: roundNumber, round_name: roundName };
  }

  static updateShortlistRoundName(companyId: string | number, roundNumber: number, roundName: string) {
    const result = db.prepare(`
      UPDATE temp_shortlists
      SET round_name = ?
      WHERE company_id = ? AND round_number = ?
    `).run(roundName, companyId, roundNumber);

    return { updatedCount: result.changes, round_number: roundNumber, round_name: roundName };
  }

  static deleteShortlistRound(companyId: string | number, roundNumber: number) {
    const result = db.prepare(`
      DELETE FROM temp_shortlists
      WHERE company_id = ? AND round_number = ?
    `).run(companyId, roundNumber);

    this.updateCompanyAnalytics(Number(companyId));
    AnalyticsService.invalidateCache();

    return { deletedCount: result.changes };
  }

  static addSelections(companyId: string | number, rawInput: any, statusInput?: string, roleInput?: string) {
    const selectionStatus = statusInput === 'intern' ? 'intern' : 'placed';
    
    // For final selections, if role is not explicitly provided, default to the company's designated job description/role
    let role = roleInput ? String(roleInput).trim() : null;
    if (!role) {
      const comp = db.prepare('SELECT role FROM companies WHERE id = ?').get(companyId) as { role?: string } | undefined;
      if (comp && comp.role && comp.role.trim()) {
        role = comp.role.trim();
      }
    }
    if (role) RolesService.ensureRoleExists(role);

    const tokens = extractCleanTokens(rawInput);
    if (tokens.length === 0) {
      throw new Error('No valid registration numbers or Neo IDs provided');
    }

    const results: any[] = [];
    const errors: any[] = [];

    const processSelectionBulk = db.transaction(() => {
      for (const item of tokens) {
        try {
          const resolved = NeoIdsService.resolveTempToken(item);
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
              INSERT OR IGNORE INTO temp_final_selection (regno, neo_id, company_id, role)
              VALUES (?, ?, ?, ?)
            `).run(resolved.regno || null, resolved.neo_id || null, companyId, role || null);
          } else {
            insertResult = db.prepare(`
              INSERT OR IGNORE INTO temp_interns_selected (regno, neo_id, company_id, role)
              VALUES (?, ?, ?, ?)
            `).run(resolved.regno || null, resolved.neo_id || null, companyId, role || null);
          }

          // Update temp_students status and role
          if (resolved.regno) {
            db.prepare(`
              UPDATE temp_students
              SET placed = 1, status = ?, final_company_id = ?, role = COALESCE(?, role)
              WHERE UPPER(regno) = UPPER(?)
            `).run(selectionStatus, companyId, role || null, resolved.regno);
          }
          if (resolved.neo_id) {
            db.prepare(`
              UPDATE temp_students
              SET placed = 1, status = ?, final_company_id = ?, role = COALESCE(?, role)
              WHERE neo_id IS NOT NULL AND UPPER(neo_id) = UPPER(?)
            `).run(selectionStatus, companyId, role || null, resolved.neo_id);
          }

          if (insertResult.changes > 0) {
            results.push({ identifier: resolved.token, regno: resolved.regno, neo_id: resolved.neo_id, role: role, success: true });
          } else {
            results.push({ identifier: resolved.token, regno: resolved.regno, neo_id: resolved.neo_id, role: role, success: true, note: 'Already recorded' });
          }
        } catch (error: any) {
          errors.push({ identifier: item, error: error.message });
        }
      }
    });

    processSelectionBulk();

    setTimeout(() => {
      try {
        this.updateCompanyAnalytics(Number(companyId));
        AnalyticsService.invalidateCache();
      } catch (err) {
        console.error('Background analytics error:', err);
      }
    }, 0);

    return { results, errors, status: selectionStatus, role };
  }

  static updateCompanyAnalytics(companyId: number) {
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

  static recalculateAllCompanyAnalytics() {
    const companies = db.prepare('SELECT id, name FROM companies').all() as Array<{ id: number; name: string }>;
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    for (const company of companies) {
      try {
        this.updateCompanyAnalytics(company.id);
        successCount++;
      } catch (error: any) {
        errorCount++;
        errors.push({ companyId: company.id, companyName: company.name, error: error.message });
      }
    }

    AnalyticsService.invalidateCache();
    return { successCount, errorCount, errors };
  }
}
