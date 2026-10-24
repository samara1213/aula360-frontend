// Imprime el hash CSP de cada <script> en línea de dist/index.html (el del
// tema). Va en script-src de la Content-Security-Policy de producción; si se
// edita el script, hay que actualizarlo o el tema dejará de aplicarse.
// Uso: yarn build && yarn csp:hash
import { readFileSync } from 'node:fs';
import { inlineScriptHashes } from './security-headers.mjs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const hashes = inlineScriptHashes(html);
if (hashes.length === 0) {
  console.error('No hay scripts en línea en dist/index.html');
  process.exit(1);
}
for (const hash of hashes) console.log(hash);
