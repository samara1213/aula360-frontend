// Imprime las cabeceras de producción con el hash del build actual, listas
// para el servidor o la CDN que sirva dist/.
// Uso: yarn build && CSP_IMG_ORIGINS="https://<proyecto>.supabase.co" yarn headers
// (CSP_CONNECT_ORIGINS si la API está en otro origen). Con --nginx, como
// directivas add_header para /etc/nginx/aula360-headers.conf.
import { readFileSync } from 'node:fs';
import { nginxHeaders, originsFromEnv, securityHeaders } from './security-headers.mjs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const headers = securityHeaders({
  html,
  imgOrigins: originsFromEnv(process.env.CSP_IMG_ORIGINS),
  connectOrigins: originsFromEnv(process.env.CSP_CONNECT_ORIGINS),
});
if (process.argv.includes('--nginx')) {
  console.log(nginxHeaders(headers));
} else {
  for (const [name, value] of Object.entries(headers)) console.log(`${name}: ${value}`);
}
