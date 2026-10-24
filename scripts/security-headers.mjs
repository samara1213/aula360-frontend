// @ts-check
// Cabeceras de seguridad de producción: una sola fuente para `yarn headers`,
// `yarn csp:hash`, `vite preview` (pruebas de e2e-prod) y deploy/nginx.conf.example.
import { createHash } from 'node:crypto';

/**
 * Hashes CSP de los <script> en línea de index.html (el del tema).
 * @param {string} html
 * @returns {string[]}
 */
export function inlineScriptHashes(html) {
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  return inline.map(
    ([, body]) =>
      `'sha256-${createHash('sha256')
        .update(body ?? '', 'utf8')
        .digest('base64')}'`,
  );
}

/**
 * Cabeceras de la aplicación (index.html y las rutas de la SPA).
 * - imgOrigins: el proyecto de Supabase (fotos por URL firmada, logos públicos).
 * - connectOrigins: el origen de la API si no es el mismo.
 * @param {{ html: string, imgOrigins?: string[], connectOrigins?: string[] }} options
 * @returns {Record<string, string>}
 */
export function securityHeaders({ html, imgOrigins = [], connectOrigins = [] }) {
  const hashes = inlineScriptHashes(html);
  // Exactamente uno (el del tema): otro script en línea pide revisar la CSP (I2 de la 3g-1).
  if (hashes.length !== 1) {
    throw new Error(
      `index.html debe tener un solo script en línea (tiene ${String(hashes.length)})`,
    );
  }
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`,
    // Sonner y Radix insertan estilos en tiempo de ejecución.
    "style-src 'self' 'unsafe-inline'",
    // Sin data: ni blob: (nada los usa; B4 de la 3g-1).
    ['img-src', "'self'", ...imgOrigins].join(' '),
    "font-src 'self'",
    ['connect-src', "'self'", ...connectOrigins].join(' '),
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
}

/**
 * Las cabeceras como directivas de nginx (`add_header "…" always;`), listas
 * para incluir en cada location (deploy/nginx.conf.example).
 * @param {Record<string, string>} headers
 * @returns {string}
 */
export function nginxHeaders(headers) {
  return Object.entries(headers)
    .map(([name, value]) => `add_header ${name} "${value.replace(/"/g, '\\"')}" always;`)
    .join('\n');
}

/** Caché: index.html siempre se revalida; assets/* llevan hash en el nombre. */
export const CACHE_HTML = 'no-cache';
export const CACHE_ASSETS = 'public, max-age=31536000, immutable';

/**
 * Orígenes extra desde variables de entorno (separados por espacios).
 * @param {string | undefined} value
 * @returns {string[]}
 */
export function originsFromEnv(value) {
  return (value ?? '').split(/\s+/).filter(Boolean);
}
