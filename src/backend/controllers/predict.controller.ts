import type { Context } from 'hono';
import { PredictService } from '../services/predict.service.js';

export class PredictController {
  static async predictCompanies(c: Context) {
    const body = await c.req.json().catch(() => ({}));
    const { cgpa, tenth, twelfth } = body;

    const companies = PredictService.predictEligibleCompanies(cgpa, tenth, twelfth);
    return c.json(companies);
  }
}
