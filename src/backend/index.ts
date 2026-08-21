import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import fs from 'fs';
import { join } from 'path';
import { authMiddleware } from './middleware/auth.middleware.js';
import apiRouter from './routes/api.routes.js';

// Load .env configuration
try {
  const envPath = join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
} catch (_) { }

const app = new Hono();

// Global Middlewares
app.use('/*', cors());
app.use('*', authMiddleware);

// Mount API Routes
app.route('/api', apiRouter);

// Serve frontend static build files
app.use('/*', serveStatic({ root: './dist' }));

const port = Number(process.env.PORT) || 3001;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});

export default app;
