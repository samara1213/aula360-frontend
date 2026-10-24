# Aula360 · frontend

Interfaz web de Aula360, el SaaS para instituciones educativas de Colombia. Consume la API del backend (`aula360-backend`).

React 19, Vite y TypeScript estricto · Tailwind 4 con componentes estilo shadcn/ui (Radix) · TanStack Query · React Router · react-hook-form + zod · cliente tipado con `openapi-fetch` · Vitest + MSW · Playwright + axe.

## Requisitos

- Node 22.12 o superior (con 22.22 o superior se podría pasar a react-router 8).
- Yarn 1 (`yarn`, nunca `npm`).
- El backend corriendo en `http://localhost:3000` con `CORS_ORIGINS` y `FRONTEND_URL` en `http://localhost:5173`.

## Comandos

```
yarn              # instalar
yarn dev          # http://localhost:5173 (proxy /api → localhost:3000)
yarn typecheck
yarn lint
yarn test         # Vitest
yarn test:e2e     # Playwright (levanta yarn dev; la API va simulada)
yarn test:e2e:prod # Playwright sobre el build con las cabeceras de producción
yarn test:e2e:integration # Playwright contra el backend real (ver «Pruebas contra el backend»)
yarn build        # dist/
yarn headers      # cabeceras de producción con el hash del build (después de yarn build; --nginx para nginx)
yarn api:types    # regenera src/api/schema.d.ts desde ../aula360-backend/openapi.json
yarn csp:hash     # hash del script del tema para la CSP (después de yarn build)
```

Primera vez con Playwright: `npx playwright install chromium`.

Para regenerar los tipos de la API: en el backend `yarn openapi:export openapi.json` y aquí `yarn api:types`.

## Sesión

- Las cookies httpOnly del backend llevan la sesión; el frontend nunca lee ni guarda tokens.
- En desarrollo el proxy de Vite sirve `/api` desde el mismo origen. En producción, sirve el frontend **en el mismo sitio** que la API (p. ej. `app.colegio.co` y `api.colegio.co`, o la API bajo `/api` del mismo dominio): las cookies `SameSite=Lax` no viajan en `fetch` entre sitios distintos. Si la API está en otro origen, `VITE_API_BASE_URL` (queda en el bundle: nunca secretos en variables `VITE_*`).

## Despliegue

1. `yarn build` genera `dist/` (`index.html` y `assets/`, con hash en el nombre).
2. `CSP_IMG_ORIGINS="https://<proyecto>.supabase.co" yarn headers` imprime las cabeceras de seguridad con el hash del build (`CSP_CONNECT_ORIGINS` si la API está en otro origen); con `--nginx`, como directivas `add_header` listas para incluir. La fuente única es `scripts/security-headers.mjs`: la usan también `vite preview` y `yarn test:e2e:prod`. Exige un solo script en línea en `index.html` (el del tema).
3. El servidor o CDN sirve `dist/` con esas cabeceras, solo por https (http redirige). Ejemplo completo con la API bajo `/api`: `deploy/nginx.conf.example` (redirección de http, TLS 1.2+, sin archivos ocultos ni `.map`, `X-Forwarded-For` desde el borde con `TRUST_PROXY=1` en el backend).

Cabeceras (en todas las respuestas de la aplicación):

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-<yarn headers>'; style-src 'self' 'unsafe-inline'; img-src 'self' https://<proyecto>.supabase.co; font-src 'self'; connect-src 'self' <origen de la API si es otro>; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; require-trusted-types-for 'script'; trusted-types 'none'; report-to csp; report-uri /api/csp-reports
Reporting-Endpoints: csp="/api/csp-reports"
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
```

- `script-src`: sin `unsafe-inline` ni `unsafe-eval`. El único script en línea es el del tema de `index.html` (aplica el tema antes de pintar); su hash cambia si se edita, y con un hash viejo el tema deja de aplicarse sin aviso. zod corre sin `new Function` (`src/lib/zod.ts`, `jitless`; ESLint prohíbe importar `zod` directo).
- `style-src 'unsafe-inline'`: los avisos (sonner) y Radix insertan estilos en tiempo de ejecución.
- `img-src`: las fotos de perfil llegan por URL firmada de Supabase Storage (bucket privado) y los logos por la URL pública del bucket `logos`. Sin `data:` ni `blob:`: nada los usa.
- `object-src 'none'`: los PDF (boletines y vistas previas de plantillas) se abren como `blob:` en otra pestaña y heredan la CSP; el visor de PDF de Chrome los muestra igual (comprobado en `e2e-prod`, proyecto `chrome`).
- `Referrer-Policy: no-referrer`: ninguna URL de la aplicación sale en el `Referer`.
- HSTS sin `preload`: entrar en la lista de precarga de los navegadores compromete todo el dominio y sus subdominios; se decide con quien administra el dominio (ver el ejemplo de nginx).
- Trusted Types (`require-trusted-types-for 'script'; trusted-types 'none'`): el navegador no deja insertar HTML ni código como texto (`innerHTML`, `eval`, `script.src`...) y no se pueden crear políticas para saltárselo. La app no usa esos puntos y ESLint los prohíbe (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`..., y `Select` y `ScrollArea` de Radix, que montan un `<style>` con `innerHTML`). `e2e-prod` recorre las pantallas con la política y comprueba que `innerHTML` se bloquea, pero solo cubre lo que se pinta: un desplegable o un diálogo que no abre no se prueba. En desarrollo no hay CSP, así que estos fallos solo aparecen en producción. Si una librería nueva lo necesita, se decide una política con nombre; no se quita la directiva. Los navegadores sin Trusted Types la ignoran.
- Informes de violaciones: el navegador los manda al backend (`POST /api/csp-reports`, sin sesión), que guarda en su log solo la directiva, el origen de lo bloqueado y del script que la causó, la ruta de la página y, en Trusted Types, el punto bloqueado (nunca el contenido). En nginx, `location = /api/csp-reports` con su límite por IP y 64 KB (ver `deploy/nginx.conf.example`). Chrome usa `report-to` (Reporting API, agrupa y envía por su cuenta) y, si existe, ignora `report-uri`; los demás navegadores usan `report-uri`. Con la API en otro origen, `CSP_REPORT_URL` con la URL https completa al generar las cabeceras. Los orígenes (`CSP_IMG_ORIGINS`, `CSP_CONNECT_ORIGINS`) y `CSP_REPORT_URL` se validan: https (http solo en localhost), sin ruta en los orígenes y sin `;`, `,`, comillas, `$`, `\` ni espacios; si no, `yarn headers` falla. Chrome bajo Playwright no envía los informes de `report-to`: `e2e-prod` comprueba el envío por `report-uri`.
- Caché: `index.html` (y toda ruta de la SPA) con `Cache-Control: no-cache`; `assets/*` con `public, max-age=31536000, immutable`.
- Rutas: cualquier ruta desconocida devuelve `index.html` (aplicación de una sola página).
- La API en el mismo sitio (ver «Sesión»), con `CORS_ORIGINS` y `FRONTEND_URL` del backend en el origen de la aplicación.

`yarn test:e2e:prod` construye, levanta `vite preview` con estas cabeceras y recorre las pantallas: falla ante cualquier violación de la CSP o error de consola, y comprueba las cabeceras, la caché, la SPA y el script del tema. El proyecto `chrome` usa el Chrome instalado (visor de PDF real); sin Chrome, `yarn test:e2e:prod --project=chromium`.

### Pruebas contra el backend

`yarn test:e2e:integration` (`playwright.integration.config.ts`, `e2e-integration/`) recorre los flujos por rol sin API simulada: levanta el servidor de pruebas del backend (`yarn test:browser-server` en `../aula360-backend`, puerto 3100) y Vite en el 5174 con el proxy hacia él. El docente registra una nota, el estudiante la ve, el administrador genera el boletín (PDF real con Chromium) y el estudiante lo descarga; además, la vista previa del SUPER_ADMIN, el aislamiento entre instituciones y la sesión vencida, con axe y la consola limpia.

- Necesita la base de pruebas del backend: `E2E_DB_MODE=isolated`, `DATABASE_URL_TEST` y `DB_SSL_TEST` (en el `.env` del backend o en la línea de comandos). Storage y correo van en memoria: no toca Supabase ni envía correos.
- Nunca a la vez que las e2e del backend (comparten la base). Los datos que crea llevan el prefijo E2E y se barren al empezar la corrida siguiente.

### Bundle

El arranque carga `index` (la aplicación) y tres grupos de librerías que cambian poco entre despliegues (`react`, `data` y `ui`; ver `build.rolldownOptions` en `vite.config.ts`). Las pantallas van en archivos diferidos por módulo; zod y react-hook-form (`forms`) llegan solo con las pantallas de formularios, incluidas las de acceso (`features/auth/auth-routes.tsx`).

## Riesgos conocidos

- Enlaces del correo (restablecer contraseña y verificar correo): el token viaja en el fragmento (`#token=`), que no llega al servidor ni al `Referer`, y la página lo quita de la barra de direcciones apenas lo lee. Aun así, el historial global del navegador registra la URL original: en un equipo compartido, un enlace de restablecimiento sin usar sirve durante su vigencia (30 minutos). Se acepta por la vida corta del token.

## Estructura y convenciones

Ver la skill `react-frontend` (`../SKILLS_FRONTEND.md`).
