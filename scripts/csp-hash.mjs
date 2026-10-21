// Imprime el hash CSP de cada <script> en línea de dist/index.html (el del
// tema). Va en script-src de la Content-Security-Policy de producción; si se
// edita el script, hay que actualizarlo o el tema dejará de aplicarse.
// Uso: yarn build && yarn csp:hash
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
if (inline.length === 0) {
  console.error('No hay scripts en línea en dist/index.html');
  process.exit(1);
}
for (const [, body] of inline) {
  console.log(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
}
