import { Hono } from 'hono';
import { HealthController } from '../controllers/health.controller.js';

const healthRoutes = new Hono();

healthRoutes.get('/', HealthController.getHealth);

export default healthRoutes;
