import type { Context } from 'hono';
import { CompaniesService } from '../services/companies.service.js';
import { parsePlacementEmail } from '../services/gemini.service.js';
import { verifyAdminPassword } from '../utils/crypto.utils.js';

export class CompaniesController {
  static getCompanies(c: Context) {
    const companies = CompaniesService.getAll();
    return c.json(companies);
  }

  static getShortlistRounds(c: Context) {
    try {
      const id = c.req.param('id') || '';
      const result = CompaniesService.getShortlistRounds(id);
      return c.json(result);
    } catch (error: any) {
      console.error('Error fetching shortlist rounds:', error);
      return c.json({ error: 'Failed to fetch shortlist rounds', details: error.message }, 500);
    }
  }

  static getCompanyDetails(c: Context) {
    try {
      const id = c.req.param('id') || '';
      const result = CompaniesService.getCompanyDetails(id);
      if (!result) {
        return c.json({ error: 'Company not found' }, 404);
      }
      return c.json(result);
    } catch (err: any) {
      console.error('[GET /api/companies/:id] Error:', err);
      return c.json({ error: 'Internal server error', details: err?.message }, 500);
    }
  }

  static async parseEmail(c: Context) {
    try {
      const body = await c.req.json().catch(() => ({}));
      const emailText = body.emailText;
      if (!emailText || !emailText.trim()) {
        return c.json({ error: 'Please provide email text to parse.' }, 400);
      }
      const data = await parsePlacementEmail(emailText);
      return c.json({ success: true, data });
    } catch (err: any) {
      console.error('[POST /api/companies/parse-email] Error:', err);
      return c.json({ error: err.message || 'Failed to parse email with Gemini AI' }, 500);
    }
  }

  static async createCompany(c: Context) {
    try {
      const body = await c.req.json();
      const created = CompaniesService.create(body);
      return c.json(created);
    } catch (error: any) {
      console.error('[POST /api/companies] Error:', error);
      if (error.message?.includes('UNIQUE constraint failed: companies.name')) {
        return c.json({ error: 'A company with this name already exists.' }, 400);
      }
      return c.json({ error: error.message }, 400);
    }
  }

  static async updateCompany(c: Context) {
    if (!verifyAdminPassword(c.req.header('X-Admin-Password'))) {
      return c.json({ error: 'Unauthorized: Invalid admin password' }, 401);
    }
    const id = c.req.param('id') || '';
    try {
      const body = await c.req.json();
      const updated = CompaniesService.update(id, body);
      return c.json(updated);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }

  static async deleteCompany(c: Context) {
    if (!verifyAdminPassword(c.req.header('X-Admin-Password'))) {
      return c.json({ error: 'Unauthorized: Invalid admin password' }, 401);
    }
    const id = c.req.param('id') || '';

    try {
      const deleted = CompaniesService.delete(id);
      if (!deleted) {
        return c.json({ error: 'Company not found' }, 404);
      }
      return c.json({ success: true, message: `Company "${deleted.name}" deleted successfully.` });
    } catch (error: any) {
      console.error('[DELETE /api/companies/:id] Error:', error);
      return c.json({ error: 'Failed to delete company', details: error.message }, 500);
    }
  }

  static async recalculateAnalytics(c: Context) {
    try {
      const result = CompaniesService.recalculateAllCompanyAnalytics();
      return c.json({
        success: true,
        message: `Recalculated analytics for ${result.successCount} companies`,
        successCount: result.successCount,
        errorCount: result.errorCount,
        errors: result.errorCount > 0 ? result.errors : undefined
      });
    } catch (error: any) {
      console.error('Error in recalculate-analytics endpoint:', error);
      return c.json({ error: 'Internal server error', details: error.message }, 500);
    }
  }

  static async addShortlist(c: Context) {
    try {
      const companyId = c.req.param('id') || '';
      const body = await c.req.json();
      const rawInput = body.regnos || body.identifiers || [];
      const roundNumber = body.round_number;
      const roundName = body.round_name;
      const role = body.role;

      const result = CompaniesService.addShortlist(companyId, rawInput, roundNumber, roundName, role);
      return c.json(result);
    } catch (error: any) {
      console.error('Error in shortlist endpoint:', error);
      return c.json({ error: error.message || 'Internal server error' }, 400);
    }
  }

  static async updateShortlistRound(c: Context) {
    if (!verifyAdminPassword(c.req.header('X-Admin-Password'))) {
      return c.json({ error: 'Unauthorized: Invalid admin password' }, 401);
    }
    try {
      const companyId = c.req.param('id') || '';
      const roundNumber = parseInt(c.req.param('roundNumber') || '1');
      const body = await c.req.json();
      const roundName = body.round_name ? String(body.round_name).trim() : '';

      if (!roundName) {
        return c.json({ error: 'Custom shortlist round name is required' }, 400);
      }

      const result = CompaniesService.updateShortlistRoundName(companyId, roundNumber, roundName);
      return c.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error renaming shortlist round:', error);
      return c.json({ error: 'Internal server error', details: error.message }, 500);
    }
  }

  static async deleteShortlistRound(c: Context) {
    if (!verifyAdminPassword(c.req.header('X-Admin-Password'))) {
      return c.json({ error: 'Unauthorized: Invalid admin password' }, 401);
    }
    try {
      const companyId = c.req.param('id') || '';
      const roundNumber = parseInt(c.req.param('roundNumber') || '1');

      const result = CompaniesService.deleteShortlistRound(companyId, roundNumber);
      return c.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error deleting shortlist round:', error);
      return c.json({ error: 'Internal server error', details: error.message }, 500);
    }
  }

  static async addSelections(c: Context) {
    try {
      const companyId = c.req.param('id') || '';
      const body = await c.req.json();
      const rawInput = body.regnos || body.identifiers || [];
      const status = body.status;
      const role = body.role;

      const result = CompaniesService.addSelections(companyId, rawInput, status, role);
      return c.json(result);
    } catch (error: any) {
      console.error('Error in selections endpoint:', error);
      return c.json({ error: error.message || 'Internal server error' }, 400);
    }
  }
}
