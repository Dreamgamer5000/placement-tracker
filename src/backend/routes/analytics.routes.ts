import { Hono } from 'hono';
import { AnalyticsController } from '../controllers/analytics.controller.js';

const analyticsRoutes = new Hono();

analyticsRoutes.get('/summary', AnalyticsController.getSummary);

export default analyticsRoutes;
