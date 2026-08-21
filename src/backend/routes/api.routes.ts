import { Hono } from 'hono';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import rolesRoutes from './roles.routes.js';
import neoIdsRoutes from './neoIds.routes.js';
import predictRoutes from './predict.routes.js';
import analyticsRoutes from './analytics.routes.js';
import companiesRoutes from './companies.routes.js';
import studentsRoutes from './students.routes.js';

const apiRouter = new Hono();

// Auth routes (e.g. POST /api/login)
apiRouter.route('/', authRoutes);

// Health check
apiRouter.route('/health', healthRoutes);

// Feature domain routes
apiRouter.route('/roles', rolesRoutes);
apiRouter.route('/neo-ids', neoIdsRoutes);
apiRouter.route('/predict-companies', predictRoutes);
apiRouter.route('/analytics', analyticsRoutes);
apiRouter.route('/companies', companiesRoutes);
apiRouter.route('/students', studentsRoutes);

export default apiRouter;
