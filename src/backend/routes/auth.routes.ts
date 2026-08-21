import { Hono } from 'hono';
import { AuthController } from '../controllers/auth.controller.js';

const authRoutes = new Hono();

authRoutes.post('/login', AuthController.login);

export default authRoutes;
