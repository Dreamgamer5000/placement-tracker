import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { AuthService } from '../services/auth.service.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.middleware.js';

export class AuthController {
  static async login(c: Context) {
    const ip = c.req.header('x-forwarded-for') || 'unknown';

    const rateCheck = AuthService.checkRateLimit(ip);
    if (!rateCheck.allowed) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return c.json({ error: `Too many attempts. Please wait ${rateCheck.waitSeconds} seconds.` }, 429);
    }

    const body = await c.req.json().catch(() => ({}));
    const password = body.password || '';

    const isValid = AuthService.verifyPassword(ip, password);
    if (isValid) {
      setCookie(c, SESSION_COOKIE_NAME, 'authenticated', {
        maxAge: 60 * 60 * 24, // 1 day
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        path: '/'
      });
      return c.json({ success: true });
    }

    return c.json({ error: 'Invalid password' }, 401);
  }
}
