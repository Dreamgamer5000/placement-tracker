import type { Context } from 'hono';
import { RolesService } from '../services/roles.service.js';

export class RolesController {
  static getRoles(c: Context) {
    try {
      const roles = RolesService.getRoles();
      return c.json(roles);
    } catch (err: any) {
      console.error('Error in GET /api/roles:', err);
      return c.json({ error: err.message }, 500);
    }
  }

  static async createRole(c: Context) {
    try {
      const body = await c.req.json();
      const name = String(body.name || '').trim();
      const category = String(body.category || 'Engineering').trim();
      if (!name) {
        return c.json({ error: 'Role name is required' }, 400);
      }
      const role = RolesService.createRole(name, category);
      return c.json(role);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  }
}
