import { ApiError, ERROR_CODES } from '@/api/errors';

/** El 409 del alta por un documento o un correo que ya usa otra cuenta (B5). */
export function isExistingAccount(error: unknown): boolean {
  return error instanceof ApiError && error.code === ERROR_CODES.USER_ALREADY_EXISTS;
}
