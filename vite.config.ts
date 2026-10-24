import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import {
  CACHE_ASSETS,
  CACHE_HTML,
  originsFromEnv,
  securityHeaders,
} from './scripts/security-headers.mjs';

// En desarrollo, /api va al backend por el proxy: el navegador ve un solo origen
// (sin CORS y con cookies SameSite sin sorpresas). El backend valida el Origin
// (http://localhost:5173) contra CORS_ORIGINS en los métodos que modifican datos.
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:3000';

/**
 * `vite preview` con las cabeceras de producción (las mismas de
 * scripts/security-headers.mjs y del README): así e2e-prod prueba la CSP real
 * sobre el build, con el hash del script del tema de dist/index.html.
 */
function productionHeaders(): Plugin {
  return {
    name: 'aula360-production-headers',
    configurePreviewServer(server) {
      const html = readFileSync(new URL('./dist/index.html', import.meta.url), 'utf8');
      const headers = securityHeaders({
        html,
        imgOrigins: originsFromEnv(process.env.CSP_IMG_ORIGINS),
        connectOrigins: originsFromEnv(process.env.CSP_CONNECT_ORIGINS),
        reportUrl: process.env.CSP_REPORT_URL || undefined,
      });
      server.middlewares.use((req, res, next) => {
        for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
        res.setHeader('Cache-Control', req.url?.startsWith('/assets/') ? CACHE_ASSETS : CACHE_HTML);
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), productionHeaders()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Precompila al arrancar la entrada y las rutas diferidas: la primera visita a
    // cada pantalla no espera a que Vite transforme sus módulos (y las e2e, que
    // abren muchas a la vez, no se pasan del tiempo).
    warmup: { clientFiles: ['./src/main.tsx', './src/features/**/*-routes.tsx'] },
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  preview: { port: 4173, strictPort: true },
  build: {
    sourcemap: false,
    rolldownOptions: {
      output: {
        // Librerías en grupos estables: cambian poco entre despliegues y el
        // navegador las reutiliza de su caché. `forms` solo lo piden las
        // pantallas con formularios (diferidas), no el arranque.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
            },
            { name: 'data', test: /node_modules[\\/](@tanstack|openapi-fetch)[\\/]/ },
            { name: 'forms', test: /node_modules[\\/](zod|react-hook-form|@hookform)[\\/]/ },
            { name: 'ui', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
});
