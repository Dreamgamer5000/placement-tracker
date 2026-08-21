import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyAdminPassword } from '../utils/crypto.utils.js';

export const SESSION_COOKIE_NAME = 'tracker_auth_session';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const path = c.req.path;

  // Allow login endpoint
  if (path === '/api/login') {
    return next();
  }

  // Allow static assets (js, css, images, fonts) to load so the frontend doesn't break
  const isAsset = path.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot)$/);
  if (isAsset) {
    return next();
  }

  const authCookie = getCookie(c, SESSION_COOKIE_NAME);
  if (authCookie === 'authenticated') {
    return next();
  }

  // Not authenticated
  const isApi = path.startsWith('/api/');
  if (isApi) {
    return c.json({ error: 'Unauthorized. Please login.' }, 401);
  } else {
    // Return a simple login page for all HTML routes
    return c.html(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Placement Tracker - Login</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #0f172a; color: white; margin: 0; }
          .card { background: #1e293b; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); width: 100%; max-width: 350px; text-align: center; }
          h2 { margin-top: 0; color: #f8fafc; }
          input { width: 100%; padding: 0.75rem; margin-top: 1rem; margin-bottom: 1rem; border-radius: 4px; border: 1px solid #334155; background: #0f172a; color: white; box-sizing: border-box; font-size: 1rem; }
          input:focus { outline: none; border-color: #3b82f6; }
          button { width: 100%; padding: 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 1rem; transition: background 0.2s; }
          button:hover { background: #2563eb; }
          #error { color: #ef4444; margin-top: 1rem; display: none; font-size: 0.9rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Tracker Access</h2>
          <form id="loginForm">
            <input type="password" id="password" placeholder="Enter Password" required autofocus>
            <button type="submit">Login</button>
          </form>
          <div id="error">Invalid password</div>
        </div>
        <script>
          document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.querySelector('button');
            const err = document.getElementById('error');
            btn.textContent = 'Verifying...';
            btn.disabled = true;
            err.style.display = 'none';
            
            const pwd = document.getElementById('password').value;
            try {
              const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd })
              });
              if (res.ok) {
                window.location.reload();
              } else {
                const data = await res.json().catch(() => ({}));
                err.textContent = data.error || 'Invalid password';
                err.style.display = 'block';
                btn.textContent = 'Login';
                btn.disabled = false;
              }
            } catch (error) {
              err.textContent = 'Connection error';
              err.style.display = 'block';
              btn.textContent = 'Login';
              btn.disabled = false;
            }
          });
        </script>
      </body>
      </html>
    `);
  }
};

export const requireAdminAuth: MiddlewareHandler = async (c, next) => {
  const headerPwd = c.req.header('X-Admin-Password');
  if (!verifyAdminPassword(headerPwd)) {
    return c.json({ error: 'Unauthorized: Invalid admin password' }, 401);
  }
  return next();
};
