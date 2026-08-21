import { Hono } from 'hono';
import { CompaniesController } from '../controllers/companies.controller.js';

const companiesRoutes = new Hono();

// Specific sub-routes (before parameterized /:id)
companiesRoutes.post('/parse-email', CompaniesController.parseEmail);
companiesRoutes.post('/recalculate-analytics', CompaniesController.recalculateAnalytics);

// Collection routes
companiesRoutes.get('/', CompaniesController.getCompanies);
companiesRoutes.post('/', CompaniesController.createCompany);

// Shortlist & Selections routes
companiesRoutes.get('/:id/shortlist-rounds', CompaniesController.getShortlistRounds);
companiesRoutes.post('/:id/shortlist', CompaniesController.addShortlist);
companiesRoutes.put('/:id/shortlist-round/:roundNumber', CompaniesController.updateShortlistRound);
companiesRoutes.delete('/:id/shortlist-round/:roundNumber', CompaniesController.deleteShortlistRound);
companiesRoutes.post('/:id/selections', CompaniesController.addSelections);

// Parameterized /:id routes
companiesRoutes.get('/:id', CompaniesController.getCompanyDetails);
companiesRoutes.put('/:id', CompaniesController.updateCompany);
companiesRoutes.delete('/:id', CompaniesController.deleteCompany);

export default companiesRoutes;
