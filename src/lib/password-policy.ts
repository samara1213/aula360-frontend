import { z } from 'zod';

// Igual que src/common/validators/password-policy.ts del backend.
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_BYTES = 72;

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: 'Entre 10 y 72 caracteres',
    test: (v: string) => v.length >= PASSWORD_MIN_LENGTH && utf8Bytes(v) <= PASSWORD_MAX_BYTES,
  },
  { id: 'lower', label: 'Una minúscula', test: (v: string) => /[a-z]/.test(v) },
  { id: 'upper', label: 'Una mayúscula', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'digit', label: 'Un número', test: (v: string) => /\d/.test(v) },
  {
    id: 'symbol',
    label: 'Un símbolo, por ejemplo * o #',
    test: (v: string) => /[^A-Za-z0-9]/.test(v),
  },
] as const;

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

export const strongPassword = z
  .string()
  .refine((v) => PASSWORD_RULES.every((rule) => rule.test(v)), {
    message: 'La contraseña no cumple todos los requisitos de la lista.',
  });

/** Nueva contraseña + confirmación. */
export const newPasswordFields = {
  newPassword: strongPassword,
  confirmPassword: z.string().min(1, 'Repite la contraseña nueva.'),
};

export function passwordsMatch(data: { newPassword: string; confirmPassword: string }) {
  return data.newPassword === data.confirmPassword;
}

export const MISMATCH = { message: 'Las contraseñas no coinciden.', path: ['confirmPassword'] };
