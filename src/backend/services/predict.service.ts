import db from '../db/database.js';

export class PredictService {
  static predictEligibleCompanies(cgpaInput?: number | null, tenthInput?: number | null, twelfthInput?: number | null) {
    const userCgpa = cgpaInput !== undefined && cgpaInput !== null ? Number(cgpaInput) : null;
    const userTenth = tenthInput !== undefined && tenthInput !== null ? Number(tenthInput) : null;
    const userTwelfth = twelfthInput !== undefined && twelfthInput !== null ? Number(twelfthInput) : null;

    function parseCriteriaCgpa(crit: string | null | undefined): number | null {
      if (!crit) return null;
      const m = crit.match(/(\d+(?:\.\d+)?)\s*(?:cgpa|gpa)/i);
      if (m) return parseFloat(m[1]);
      return null;
    }

    function parseCriteriaPercentage(crit: string | null | undefined): number | null {
      if (!crit) return null;
      const m = crit.match(/(\d+(?:\.\d+)?)\s*%/);
      if (m) return parseFloat(m[1]);
      return null;
    }

    const companies = db.prepare(`
      SELECT 
        c.id,
        c.name,
        c.role,
        c.ctc,
        c.category,
        c.job_location,
        c.eligible_branches,
        c.eligibility_criteria,
        c.notes,
        c.total_rounds,
        c.rounds,
        ca.min_cgpa_shortlist,
        ca.avg_cgpa_shortlist,
        ca.min_tenth_shortlist,
        ca.avg_tenth_shortlist,
        ca.min_twelfth_shortlist,
        ca.avg_twelfth_shortlist,
        ca.min_cgpa_selected,
        ca.avg_cgpa_selected,
        ca.total_shortlisted,
        ca.total_selected,
        (
          SELECT MIN(CAST(s.cgpa AS REAL)) 
          FROM temp_students s 
          JOIN temp_shortlists sh ON (s.regno = sh.regno OR (sh.neo_id IS NOT NULL AND s.neo_id = sh.neo_id))
          WHERE sh.company_id = c.id AND CAST(s.cgpa AS REAL) > 0 AND CAST(s.cgpa AS REAL) <= 10.0
        ) as actual_min_cgpa_shortlist,
        (
          SELECT MAX(CAST(s.cgpa AS REAL)) 
          FROM temp_students s 
          JOIN temp_shortlists sh ON (s.regno = sh.regno OR (sh.neo_id IS NOT NULL AND s.neo_id = sh.neo_id))
          WHERE sh.company_id = c.id AND CAST(s.cgpa AS REAL) > 0 AND CAST(s.cgpa AS REAL) <= 10.0
        ) as actual_max_cgpa_shortlist,
        (
          SELECT MIN(CAST(s.cgpa AS REAL)) 
          FROM temp_students s 
          JOIN temp_final_selection fin ON (s.regno = fin.regno OR (fin.neo_id IS NOT NULL AND s.neo_id = fin.neo_id))
          WHERE fin.company_id = c.id AND CAST(s.cgpa AS REAL) > 0 AND CAST(s.cgpa AS REAL) <= 10.0
        ) as actual_min_cgpa_selected,
        (
          SELECT MAX(CAST(s.cgpa AS REAL)) 
          FROM temp_students s 
          JOIN temp_final_selection fin ON (s.regno = fin.regno OR (fin.neo_id IS NOT NULL AND s.neo_id = fin.neo_id))
          WHERE fin.company_id = c.id AND CAST(s.cgpa AS REAL) > 0 AND CAST(s.cgpa AS REAL) <= 10.0
        ) as actual_max_cgpa_selected
      FROM companies c
      LEFT JOIN company_analytics ca ON c.id = ca.company_id
      ORDER BY c.name ASC
    `).all() as any[];

    const results = companies.map(c => {
      const criteriaCgpa = parseCriteriaCgpa(c.eligibility_criteria);
      const criteriaPct = parseCriteriaPercentage(c.eligibility_criteria);

      // Prioritize drive shortlist/selection minimum, fallback to explicit criteria
      const minCgpa = c.actual_min_cgpa_shortlist 
        ?? c.min_cgpa_shortlist 
        ?? c.actual_min_cgpa_selected 
        ?? c.min_cgpa_selected 
        ?? criteriaCgpa;

      const maxCgpa = c.actual_max_cgpa_shortlist 
        ?? c.actual_max_cgpa_selected 
        ?? (minCgpa ? Math.min(10.0, Number((minCgpa + 0.8).toFixed(2))) : null);

      const avgCgpa = c.avg_cgpa_shortlist 
        ?? c.avg_cgpa_selected 
        ?? (minCgpa && maxCgpa ? Number(((minCgpa + maxCgpa) / 2).toFixed(2)) : minCgpa);

      const minTenth = c.min_tenth_shortlist ?? criteriaPct ?? null;
      const minTwelfth = c.min_twelfth_shortlist ?? criteriaPct ?? null;

      // Determine eligibility based on criteria and historical cutoffs
      let isEligible = true;
      if (userCgpa !== null && minCgpa !== null) {
        if (userCgpa < minCgpa) isEligible = false;
      }
      if (userTenth !== null && minTenth !== null) {
        if (userTenth < minTenth) isEligible = false;
      }
      if (userTwelfth !== null && minTwelfth !== null) {
        if (userTwelfth < minTwelfth) isEligible = false;
      }

      return {
        id: c.id,
        name: c.name,
        role: c.role,
        ctc: c.ctc,
        category: c.category,
        job_location: c.job_location,
        eligible_branches: c.eligible_branches,
        eligibility_criteria: c.eligibility_criteria,
        notes: c.notes,
        total_rounds: c.total_rounds || c.rounds,
        total_shortlisted: c.total_shortlisted || 0,
        total_selected: c.total_selected || 0,
        min_cgpa: minCgpa,
        max_cgpa: maxCgpa,
        avg_cgpa: avgCgpa,
        min_tenth: minTenth,
        min_twelfth: minTwelfth,
        is_eligible: isEligible
      };
    });

    // Return eligible companies sorted by highest CTC or highest shortlist minimum
    return results
      .filter(c => c.is_eligible)
      .sort((a, b) => {
        // Companies with known cutoffs sorted in descending order of selectivity
        if (a.min_cgpa !== null && b.min_cgpa !== null) {
          return b.min_cgpa - a.min_cgpa;
        }
        if (a.min_cgpa !== null) return -1;
        if (b.min_cgpa !== null) return 1;
        return a.name.localeCompare(b.name);
      });
  }
}
