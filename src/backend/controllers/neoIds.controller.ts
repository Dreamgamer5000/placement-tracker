import type { Context } from 'hono';
import { NeoIdsService } from '../services/neoIds.service.js';
import { verifyAdminPassword } from '../utils/crypto.utils.js';

export class NeoIdsController {
  static getAll(c: Context) {
    const records = NeoIdsService.getAll();
    return c.json(records);
  }

  static search(c: Context) {
    const neoid = c.req.param('neoid') || '';
    const result = NeoIdsService.search(neoid);
    return c.json(result);
  }

  static async batchLookup(c: Context) {
    try {
      const body = await c.req.json();
      const neoids = body.neoids || [];

      if (!Array.isArray(neoids)) {
        return c.json({ error: 'Expected an array of neoids' }, 400);
      }

      const results = NeoIdsService.batchLookup(neoids);
      return c.json({ results });
    } catch (err: any) {
      console.error('[POST /api/neo-ids/batch-lookup] Error:', err);
      return c.json({ error: err.message || 'Internal error' }, 500);
    }
  }

  static async batchMapRegno(c: Context) {
    if (!verifyAdminPassword(c.req.header('X-Admin-Password'))) {
      return c.json({ error: 'Invalid admin password' }, 401);
    }

    try {
      const body = await c.req.json();
      const mappings: { neoid: string; regno: string }[] = body.mappings || [];

      if (!mappings.length) {
        return c.json({ error: 'No mappings provided' }, 400);
      }

      const result = NeoIdsService.batchMapRegno(mappings);

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
  }

  static async batchSetCampus(c: Context) {
    if (!verifyAdminPassword(c.req.header('X-Admin-Password'))) {
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

      const updatedCount = NeoIdsService.batchSetCampus(neoids, campus);

      return c.json({
        success: true,
        message: `Set campus to '${campus}' for ${updatedCount} Neo IDs.`,
        updatedCount
      });
    } catch (err: any) {
      console.error('[POST /api/neo-ids/batch-set-campus] Error:', err);
      return c.json({ error: 'Failed to batch set campus', details: err?.message }, 500);
    }
  }
}
