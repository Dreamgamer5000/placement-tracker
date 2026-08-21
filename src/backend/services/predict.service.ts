import db from '../db/database.js';

export class PredictService {
  static predictEligibleCompanies(cgpa?: number | null, tenth?: number | null, twelfth?: number | null) {
    return db.prepare(`
      SELECT c.*, ca.*
      FROM companies c
      LEFT JOIN company_analytics ca ON c.id = ca.company_id
      WHERE (ca.min_cgpa_shortlist IS NULL OR ca.min_cgpa_shortlist <= ?)
        AND (ca.min_tenth_shortlist IS NULL OR ca.min_tenth_shortlist <= ?)
        AND (ca.min_twelfth_shortlist IS NULL OR ca.min_twelfth_shortlist <= ?)
      ORDER BY ca.min_cgpa_shortlist DESC, ca.min_tenth_shortlist DESC, ca.min_twelfth_shortlist DESC
    `).all(cgpa ?? 10, tenth ?? 100, twelfth ?? 100);
  }
}
