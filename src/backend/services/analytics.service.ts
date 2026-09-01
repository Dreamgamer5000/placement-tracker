import db from '../db/database.js';
import { StudentsService } from './students.service.js';

let cachedAnalyticsSummary: any = null;

export class AnalyticsService {
  static invalidateCache(): void {
    cachedAnalyticsSummary = null;
  }

  static getAnalyticsSummary(forceRecalculate: boolean = false) {
    if (forceRecalculate || !cachedAnalyticsSummary) {
      if (forceRecalculate) {
        try {
          StudentsService.recalculateStudentAnalytics();
        } catch (e) {
          console.error('Error during auto-recalculation in getAnalyticsSummary:', e);
        }
      }
      cachedAnalyticsSummary = this.computeAnalyticsSummary();
    }
    return cachedAnalyticsSummary;
  }

  static computeAnalyticsSummary() {
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
      SELECT 
        CASE 
          WHEN COALESCE(s.campus, n.campus) LIKE '%Chennai%' THEN 'Chennai'
          WHEN COALESCE(s.campus, n.campus) LIKE '%Vellore%' THEN 'Vellore'
          ELSE 'Unknown'
        END as campus,
        COUNT(DISTINCT COALESCE(s.regno, sel.regno, sel.neo_id)) as interned
      FROM temp_interns_selected sel
      LEFT JOIN temp_students s ON (s.regno = sel.regno OR (sel.neo_id IS NOT NULL AND sel.neo_id != '' AND s.neo_id = sel.neo_id))
      LEFT JOIN temp_neoid_table n ON (n.neoid = sel.neo_id OR (sel.regno IS NOT NULL AND sel.regno != '' AND n.regno = sel.regno))
      GROUP BY 1
      ORDER BY interned DESC
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
}
