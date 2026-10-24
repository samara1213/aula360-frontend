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

/** Dónde el navegador informa las violaciones de la CSP (POST /api/csp-reports del backend). */
export const CSP_REPORT_URL = '/api/csp-reports';

// Lo que separa directivas o cabeceras (punto y coma, coma), las comillas y lo
// que nginx interpreta dentro de comillas (dólar, barra invertida): un valor con
// eso por error de configuración agregaría directivas o rompería la cabecera
// (B4 de la entrega C).
const UNSAFE = /[\s;,"'\\$]/;

/**
 * Un origen https (o http en localhost, para pruebas) tal cual, sin ruta.
 * @param {string} value
 * @param {string} label
 */
function assertOrigin(value, label) {
  const url = parseSafeUrl(value, label);
  if (url.origin !== value) {
    throw new Error(
      `${label}: «${value}» debe ser solo un origen (https://host[:puerto]), sin ruta`,
    );
  }
}

/**
 * El endpoint de informes: una ruta del mismo sitio (/api/csp-reports) o una
 * URL https completa.
 * @param {string} value
 */
function assertReportUrl(value) {
  if (value.startsWith('/')) {
    if (!/^\/[A-Za-z0-9\-._~/]*$/.test(value) || value.startsWith('//')) {
      throw new Error(`CSP_REPORT_URL: «${value}» no es una ruta válida`);
    }
    return;
  }
  parseSafeUrl(value, 'CSP_REPORT_URL');
}

/**
 * @param {string} value
 * @param {string} label
 * @returns {URL}
 */
function parseSafeUrl(value, label) {
  if (UNSAFE.test(value)) {
    throw new Error(`${label}: «${value}» tiene caracteres no permitidos`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label}: «${value}» no es una URL`);
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error(`${label}: «${value}» debe usar https`);
  }
  return url;
}

/**
 * Cabeceras de la aplicación (index.html y las rutas de la SPA).
 * - imgOrigins: el proyecto de Supabase (fotos por URL firmada, logos públicos).
 * - connectOrigins: el origen de la API si no es el mismo.
 * - reportUrl: el endpoint de informes de la CSP (con la API en otro origen,
 *   su URL completa).
 * @param {{ html: string, imgOrigins?: string[], connectOrigins?: string[], reportUrl?: string }} options
 * @returns {Record<string, string>}
 */
export function securityHeaders({
  html,
  imgOrigins = [],
  connectOrigins = [],
  reportUrl = CSP_REPORT_URL,
}) {
  for (const origin of imgOrigins) assertOrigin(origin, 'CSP_IMG_ORIGINS');
  for (const origin of connectOrigins) assertOrigin(origin, 'CSP_CONNECT_ORIGINS');
  assertReportUrl(reportUrl);
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
    // Trusted Types: el navegador no deja insertar HTML ni código como texto
    // (innerHTML, eval, script.src...) y nadie puede crear políticas para
    // saltárselo. La app no usa esos puntos; e2e-prod lo comprueba.
    "require-trusted-types-for 'script'",
    "trusted-types 'none'",
    // Informes de violaciones: report-to (Reporting API) y report-uri para los
    // navegadores que aún no la tienen (Chrome usa report-to si existe).
    'report-to csp',
    `report-uri ${reportUrl}`,
  ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'Reporting-Endpoints': `csp="${reportUrl}"`,
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
    .map(([name, value]) => {
      // nginx interpola $variables y escapes dentro de las comillas (B4).
      if (/[$\\\r\n]/.test(value)) {
        throw new Error(`La cabecera ${name} tiene caracteres que nginx interpretaría`);
      }
      return `add_header ${name} "${value.replace(/"/g, '\\"')}" always;`;
    })
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
