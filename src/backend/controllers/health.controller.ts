import type { Context } from 'hono';

export class HealthController {
  static getHealth(c: Context) {
    return c.json({ status: 'ok' });
  }
}
