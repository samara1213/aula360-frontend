import { z } from 'zod';

/** Opcional: vacío se envía como null (así se borra al editar). */
export const optional = (max: number, valid: (value: string) => boolean, message: string) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${String(max)} caracteres.`)
    .refine((value) => value === '' || valid(value), message)
    .transform((value) => value || null);

export const EMAIL = z.email();

// Las mismas reglas que UserPersonalDataDto del backend.
export const personalDataSchema = z.object({
  documentType: z.string().min(1, 'Elige el tipo de documento.'),
  documentNumber: z
    .string()
    .trim()
    .min(1, 'Escribe el número de documento.')
    .max(50, 'Máximo 50 caracteres.')
    .regex(/^[0-9A-Za-z-]+$/, 'Solo números, letras y guiones (sin espacios ni puntos).'),
  firstName: z.string().trim().min(1, 'Escribe los nombres.').max(100, 'Máximo 100 caracteres.'),
  lastName: z.string().trim().min(1, 'Escribe los apellidos.').max(100, 'Máximo 100 caracteres.'),
  email: optional(
    255,
    (value) => EMAIL.safeParse(value).success,
    'Escribe un correo válido, como ana@colegio.edu.co.',
  ),
  phone: optional(50, (value) => /^[0-9+() -]+$/.test(value), 'Solo números, espacios y + ( ) -.'),
});

export type PersonalDataInput = z.input<typeof personalDataSchema>;
export type PersonalData = z.output<typeof personalDataSchema>;

export const emptyPersonalData: PersonalDataInput = {
  documentType: 'CC',
  documentNumber: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
};
