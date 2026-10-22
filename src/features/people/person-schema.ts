import { z } from 'zod';
import {
  EMAIL,
  emptyPersonalData,
  optional,
  personalDataSchema,
} from '@/features/security/user-schema';

const anyText = () => true;
const PHONE = /^[0-9+() -]+$/;

// Las mismas reglas que TeacherProfileFieldsDto del backend.
export const teacherFields = {
  academicDegree: optional(150, anyText, ''),
  specialty: optional(150, anyText, ''),
};

export const teacherSchema = personalDataSchema.extend({
  ...teacherFields,
  campusId: z.string(),
});
export type TeacherInput = z.input<typeof teacherSchema>;
export type TeacherValues = z.output<typeof teacherSchema>;

export const emptyTeacher: TeacherInput = {
  ...emptyPersonalData,
  academicDegree: '',
  specialty: '',
  campusId: '',
};

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

// Las mismas reglas que StudentProfileFieldsDto del backend.
export const studentFields = {
  studentCode: optional(
    50,
    (value) => /^[0-9A-Za-z-]+$/.test(value),
    'Solo números, letras y guiones (sin espacios).',
  ),
  guardianName: optional(150, anyText, ''),
  guardianPhone: optional(50, (value) => PHONE.test(value), 'Solo números, espacios y + ( ) -.'),
  guardianEmail: optional(
    255,
    (value) => EMAIL.safeParse(value).success,
    'Escribe un correo válido, como acudiente@correo.com.',
  ),
  bloodType: z.enum(['', ...BLOOD_TYPES]).transform((value) => value || null),
};

export const studentSchema = personalDataSchema.extend({
  ...studentFields,
  campusId: z.string(),
});
export type StudentInput = z.input<typeof studentSchema>;
export type StudentValues = z.output<typeof studentSchema>;

export const emptyStudent: StudentInput = {
  ...emptyPersonalData,
  documentType: 'TI',
  studentCode: '',
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  bloodType: '',
  campusId: '',
};

/** Solo lo que cambió respecto a lo guardado (null y '' cuentan igual). */
export function changedFields<T extends Record<string, unknown>>(
  values: T,
  saved: Partial<Record<keyof T, unknown>>,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => (saved[key] ?? null) !== (value ?? null)),
  ) as Partial<T>;
}
