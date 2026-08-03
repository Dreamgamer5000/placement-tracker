import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

/**
 * vite.temp.config.js
 * Serves temp_index.html (→ temp_main.ts → temp_App.svelte → TempStudentList)
 * on port 5174, proxying /api to the temp backend on 3001.
 *
 * Run via:  npm run dev:temp
 */

// Custom plugin: intercept root requests and serve temp_index.html instead of index.html
function serveTempHtml() {
  return {
    name: 'serve-temp-html',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Rewrite root and /index.html requests to temp_index.html
        if (req.url === '/' || req.url === '/index.html') {
          const tempHtml = path.resolve('temp_index.html');
          let html = fs.readFileSync(tempHtml, 'utf-8');
          // Let vite transform it (injects HMR, etc.)
          server.transformIndexHtml(req.url, html).then((transformed) => {
            res.setHeader('Content-Type', 'text/html');
            res.end(transformed);
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    svelte(),
    serveTempHtml()
  ],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
