import type { Context } from 'hono';
import { StudentsService } from '../services/students.service.js';
import { verifyAdminPassword } from '../utils/crypto.utils.js';

export class StudentsController {
  static getStudents(c: Context) {
    const search = c.req.query('search')?.trim() || '';
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const sortByShortlists = c.req.query('sortByShortlists') === 'true' || c.req.query('sort') === 'shortlists';
    const unmappedChennai = c.req.query('unmappedChennai') === 'true';
    const masters = c.req.query('masters') === 'true';
    const sort = c.req.query('sort');

    const result = StudentsService.getStudents({
      search,
      page,
      limit,
      sortByShortlists,
      unmappedChennai,
      masters,
      sort
    });

    return c.json(result);
  }

  static getStudentsByShortlists(c: Context) {
    const result = StudentsService.getStudentsByShortlists();
    return c.json(result);
  }

  static searchStudent(c: Context) {
    const regno = c.req.param('regno') || '';
    const student = StudentsService.searchStudentByRegno(regno);

    if (!student) {
      return c.json({ error: 'Student not found' }, 404);
    }

    return c.json(student);
  }

  static getStudentDetails(c: Context) {
    const param = c.req.param('regno') || '';
    const student = StudentsService.getStudentDetails(param);

    if (!student) {
      return c.json({ error: 'Student not found' }, 404);
    }

    return c.json(student);
  }

  static async updateStudent(c: Context) {
    if (!verifyAdminPassword(c.req.header('X-Admin-Password'))) {
      return c.json({ error: 'Unauthorized: Invalid admin password' }, 401);
    }
    const param = c.req.param('regno') || '';

    try {
      const body = await c.req.json();
      const updated = StudentsService.updateStudent(param, body);
      return c.json(updated || { success: true });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to update student' }, 400);
    }
  }

  static async batchLookupNames(c: Context) {
    try {
      const body = await c.req.json();
      const names: string[] = body.names || [];

      if (!names.length) {
        return c.json({ error: 'No names provided' }, 400);
      }

      const results = StudentsService.batchLookupNames(names);
      return c.json({ results });
    } catch (err: any) {
      console.error('[POST /api/students/batch-lookup-names] Error:', err);
      return c.json({ error: 'Failed to lookup names', details: err?.message }, 500);
    }
  }

  static recalculateAnalytics(c: Context) {
    try {
      const result = StudentsService.recalculateStudentAnalytics();
      return c.json({
        success: true,
        message: 'Recalculated student analytics and NeoID mappings successfully.',
        ...result
      });
    } catch (err: any) {
      console.error('[POST /api/students/recalculate-analytics] Error:', err);
      return c.json({ error: 'Failed to recalculate student analytics', details: err?.message }, 500);
    }
  }

  static async placeStudent(c: Context) {
    const studentId = c.req.param('id') || '';
    try {
      const body = await c.req.json();
      const { companyId, role } = body;
      StudentsService.placeStudent(studentId, companyId, role);
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
}
