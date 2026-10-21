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
yarn build        # dist/
yarn api:types    # regenera src/api/schema.d.ts desde ../aula360-backend/openapi.json
yarn csp:hash     # hash del script del tema para la CSP (después de yarn build)
```

Primera vez con Playwright: `npx playwright install chromium`.

Para regenerar los tipos de la API: en el backend `yarn openapi:export openapi.json` y aquí `yarn api:types`.

## Sesión

- Las cookies httpOnly del backend llevan la sesión; el frontend nunca lee ni guarda tokens.
- En desarrollo el proxy de Vite sirve `/api` desde el mismo origen. En producción, sirve el frontend **en el mismo sitio** que la API (p. ej. `app.colegio.co` y `api.colegio.co`, o la API bajo `/api` del mismo dominio): las cookies `SameSite=Lax` no viajan en `fetch` entre sitios distintos. Si la API está en otro origen, `VITE_API_BASE_URL` (queda en el bundle: nunca secretos en variables `VITE_*`).

## Producción: cabeceras de seguridad

El servidor o CDN que sirva `dist/` debe enviar:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-<yarn csp:hash>'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://<proyecto>.supabase.co; font-src 'self'; connect-src 'self' <origen de la API si es otro>; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
```

- `script-src`: el hash del script en línea de `index.html` (aplica el tema antes de pintar). Calcúlalo sobre el build con `yarn build && yarn csp:hash`; si se edita ese script hay que actualizar el hash, o el tema deja de aplicarse sin aviso.
- `style-src 'unsafe-inline'`: los avisos (sonner) y Radix insertan estilos en tiempo de ejecución.
- `img-src`: las fotos de perfil y los logos llegan por URL firmada de Supabase Storage.
- Caché: `index.html` con `Cache-Control: no-cache`; `assets/*` (llevan hash en el nombre) con `public, max-age=31536000, immutable`.
- Rutas: cualquier ruta desconocida debe devolver `index.html` (aplicación de una sola página).

## Riesgos conocidos

- Enlaces del correo (restablecer contraseña y verificar correo): el token viaja en el fragmento (`#token=`), que no llega al servidor ni al `Referer`, y la página lo quita de la barra de direcciones apenas lo lee. Aun así, el historial global del navegador registra la URL original: en un equipo compartido, un enlace de restablecimiento sin usar sirve durante su vigencia (30 minutos). Se acepta por la vida corta del token.

## Estructura y convenciones

Ver la skill `react-frontend` (`../SKILLS_FRONTEND.md`).
