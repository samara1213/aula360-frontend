import type { components } from './schema';

type ErrorBody = components['schemas']['ErrorResponseDto'];

/** Códigos estables del backend (src/common/constants/error-codes.ts). */
export const ERROR_CODES = {
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  REFRESH_TOKEN_ROTATED: 'REFRESH_TOKEN_ROTATED',
  /** Al boletín le faltan definitivas: se puede generar de todos modos (409). */
  REPORT_CARD_PENDING_FINALS: 'REPORT_CARD_PENDING_FINALS',
  /** Documento o correo que ya usa otra cuenta (409): se ofrece invitarla. */
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
} as const;

/** Error de la API con el formato de AllExceptionsFilter del backend. */
export class ApiError extends Error {
  readonly status: number;
  /** Mensajes para mostrar (en los 400 de validación, uno por campo). */
  readonly messages: string[];
  /** Código estable, si el backend lo envía (ERROR_CODES). */
  readonly code: string | undefined;

  constructor(status: number, messages: string[], code?: string) {
    super(messages[0] ?? 'Error inesperado');
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
    this.code = code;
  }
}

const FALLBACK: Record<number, string> = {
  0: 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
  401: 'Tu sesión terminó. Vuelve a ingresar.',
  403: 'No tienes permiso para hacer esto.',
  404: 'No encontramos lo que buscabas.',
  429: 'Hiciste demasiados intentos. Espera un minuto e inténtalo de nuevo.',
  500: 'Algo falló en el servidor. Inténtalo de nuevo en unos minutos.',
};

function isErrorBody(value: unknown): value is ErrorBody {
  return typeof value === 'object' && value !== null && 'statusCode' in value && 'message' in value;
}

/** Convierte el cuerpo de error (o su ausencia) en un ApiError con mensajes en español. */
export function toApiError(status: number, body: unknown): ApiError {
  const code = isErrorBody(body) && typeof body.code === 'string' ? body.code : undefined;
  if (isErrorBody(body)) {
    const raw = body.message;
    const messages = (Array.isArray(raw) ? raw : [raw]).filter(
      (m): m is string => typeof m === 'string' && m.length > 0,
    );
    // Los 5xx nunca muestran el texto del servidor.
    if (messages.length > 0 && status < 500) return new ApiError(status, messages, code);
  }
  const fallback = FALLBACK[status] ?? (status >= 500 ? FALLBACK[500] : 'Error inesperado');
  return new ApiError(status, [fallback ?? 'Error inesperado'], code);
}

export const NETWORK_ERROR_MESSAGE = FALLBACK[0] ?? '';

/** Mensaje principal para mostrar al usuario a partir de cualquier error. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return NETWORK_ERROR_MESSAGE;
}

/** El mensaje como oración (con punto final) para continuar con otra. */
export function errorSentence(error: unknown): string {
  const text = errorMessage(error).trim();
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}
