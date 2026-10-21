import createClient, { type Middleware } from 'openapi-fetch';
import { ERROR_CODES, toApiError } from './errors';
import type { paths } from './schema';
import type { Session } from './types';

/**
 * Cliente tipado de la API. Las cookies httpOnly viajan solas (credentials:
 * 'include'); el frontend nunca ve ni guarda tokens.
 *
 * En desarrollo las rutas /api pasan por el proxy de Vite (mismo origen). En
 * producción, VITE_API_BASE_URL apunta al backend si está en otro dominio.
 */
const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? window.location.origin;

const REFRESH_PATH = '/api/auth/refresh-token';
const ME_PATH = '/api/auth/me';
// Rutas cuyo 401 no significa «sesión vencida» (credenciales o la propia renovación).
const NO_REFRESH = new Set(['/api/auth/login', REFRESH_PATH, '/api/auth/logout']);

const REFRESH_LOCK = 'aula360-refresh';
// Marca (solo una hora, nada sensible) de la última renovación en cualquier pestaña.
const REFRESHED_AT_KEY = 'aula360.refreshedAt';
const RECENT_REFRESH_MS = 10_000;
const REFRESH_TIMEOUT_MS = 10_000;

export type RefreshOutcome =
  /** Sesión renovada; `session` es /auth/me después de renovar (null si no se pudo leer). */
  | { status: 'ok'; session: Session | null }
  /** Sesión inválida o vencida (401): hay que volver a ingresar. */
  | { status: 'expired' }
  /** Red, 5xx o 429: la sesión puede seguir viva, no se expulsa al usuario. */
  | { status: 'transient' };

export type SessionHooks = {
  /** La renovación respondió 401: limpiar la caché y llevar al login. */
  expired: () => void;
  /** Institución activa que muestra la interfaz (undefined si no hay sesión cargada). */
  activeInstitution: () => string | null | undefined;
  /** Tras renovar, la institución activa ya no es la que muestra la interfaz. */
  institutionChanged: (session: Session) => void;
};

const NO_HOOKS: SessionHooks = {
  expired: () => undefined,
  activeInstitution: () => undefined,
  institutionChanged: () => undefined,
};
let hooks: SessionHooks = NO_HOOKS;

/** Lo registra la capa de sesión (SessionBridge). */
export function setSessionHooks(next: SessionHooks | null) {
  hooks = next ?? NO_HOOKS;
}

function readRefreshedAt(): number {
  try {
    return Number(localStorage.getItem(REFRESHED_AT_KEY)) || 0;
  } catch {
    return 0;
  }
}

function markRefreshed() {
  try {
    localStorage.setItem(REFRESHED_AT_KEY, String(Date.now()));
  } catch {
    // Sin almacenamiento: el candado entre pestañas sigue evitando la carrera.
  }
}

/**
 * Exclusiva entre pestañas (Web Locks): dos renovaciones con el mismo refresh
 * token hacen que el backend cierre todas las sesiones del usuario (A1 de la
 * fase 3a). Sin Web Locks queda la exclusión dentro de la pestaña y el margen
 * de carrera del backend (REFRESH_TOKEN_ROTATED).
 */
function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    // request() resuelve con lo que resuelve la tarea (los tipos de la DOM no lo reflejan).
    return navigator.locks.request(REFRESH_LOCK, task) as unknown as Promise<T>;
  }
  return task();
}

async function postRefresh(): Promise<RefreshOutcome['status']> {
  // Otra pestaña acaba de renovar: las cookies nuevas ya están en el navegador.
  if (Date.now() - readRefreshedAt() < RECENT_REFRESH_MS) return 'ok';
  let res: Response;
  try {
    res = await fetch(new URL(REFRESH_PATH, BASE_URL), {
      method: 'POST',
      credentials: 'include',
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  } catch {
    return 'transient';
  }
  if (res.ok) {
    markRefreshed();
    return 'ok';
  }
  if (res.status === 401) {
    const body: unknown = await res.json().catch(() => null);
    const rotated =
      typeof body === 'object' &&
      body !== null &&
      (body as { code?: unknown }).code === ERROR_CODES.REFRESH_TOKEN_ROTATED;
    return rotated ? 'ok' : 'expired';
  }
  return 'transient';
}

async function readSession(): Promise<Session | null> {
  try {
    const res = await fetch(new URL(ME_PATH, BASE_URL), {
      credentials: 'include',
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    return res.ok ? ((await res.json()) as Session) : null;
  } catch {
    return null;
  }
}

let refreshing: Promise<RefreshOutcome> | null = null;

/** Las peticiones que reciben 401 a la vez comparten una sola renovación. */
export function refreshSession(): Promise<RefreshOutcome> {
  refreshing ??= withRefreshLock(async (): Promise<RefreshOutcome> => {
    const status = await postRefresh();
    if (status !== 'ok') return { status };
    return { status, session: await readSession() };
  }).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function jsonResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ statusCode: status, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Copia de cada petición antes de enviarla, para poder repetirla tras renovar.
const pending = new WeakMap<Request, Request>();

const refreshOn401: Middleware = {
  onRequest({ request }) {
    pending.set(request, request.clone());
    return request;
  },
  async onResponse({ request, response }) {
    const copy = pending.get(request);
    pending.delete(request);
    if (response.status !== 401 || !copy) return response;
    const path = new URL(request.url).pathname;
    if (NO_REFRESH.has(path)) return response;

    const outcome = await refreshSession();
    if (outcome.status === 'transient') {
      // 503: TanStack Query lo reintenta y la sesión no se da por cerrada.
      return jsonResponse(503, 'No pudimos renovar la sesión');
    }
    if (outcome.status === 'expired') {
      hooks.expired();
      return response;
    }

    // Si la institución activa cambió (p. ej. lo retiraron de la que tenía),
    // la petición no se repite: se ejecutaría en otra institución (M1).
    const expected = hooks.activeInstitution();
    const actual = outcome.session?.activeInstitutionId ?? null;
    if (path !== ME_PATH && outcome.session && expected !== undefined && actual !== expected) {
      hooks.institutionChanged(outcome.session);
      return jsonResponse(
        409,
        'Tu institución activa cambió. Revisa los datos y vuelve a intentarlo.',
      );
    }

    const retried = await fetch(copy);
    if (retried.status === 401) hooks.expired();
    return retried;
  },
};

export const api = createClient<paths>({
  baseUrl: BASE_URL,
  credentials: 'include',
  // fetch se resuelve en cada llamada (no al importar), para que lo vean los
  // interceptores de las pruebas y las extensiones de monitoreo.
  fetch: (request) => globalThis.fetch(request),
});
api.use(refreshOn401);

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Devuelve los datos o lanza ApiError (para TanStack Query y los formularios). */
export async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
  let result: Result<T>;
  try {
    result = await promise;
  } catch {
    throw toApiError(0, undefined);
  }
  if (!result.response.ok) throw toApiError(result.response.status, result.error);
  return result.data as T;
}
