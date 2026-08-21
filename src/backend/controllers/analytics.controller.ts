import type { Context } from 'hono';
import { AnalyticsService } from '../services/analytics.service.js';

export class AnalyticsController {
  static getSummary(c: Context) {
    const recalculate = c.req.query('recalculate') === 'true';
    const summary = AnalyticsService.getAnalyticsSummary(recalculate);
    return c.json(summary);
  }
}
