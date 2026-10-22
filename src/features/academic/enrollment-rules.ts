import type { EnrollmentStatus } from '@/api/types';

/** Igual que ENROLLMENT_STATUSES del backend. */
export const ENROLLMENT_STATUSES: readonly EnrollmentStatus[] = [
  'ENROLLED',
  'SUSPENDED',
  'DROPPED',
  'GRADUATED',
];

export const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  ENROLLED: 'Matriculado',
  SUSPENDED: 'Suspendido',
  DROPPED: 'Retirado',
  GRADUATED: 'Graduado',
};

export const STATUS_VARIANTS: Record<
  EnrollmentStatus,
  'active' | 'caution' | 'inactive' | 'highlight'
> = {
  ENROLLED: 'active',
  SUSPENDED: 'caution',
  DROPPED: 'inactive',
  GRADUATED: 'highlight',
};

/** Cambios de estado permitidos (los mismos del backend; Graduado es definitivo). */
export const TRANSITIONS: Record<EnrollmentStatus, readonly EnrollmentStatus[]> = {
  ENROLLED: ['SUSPENDED', 'DROPPED', 'GRADUATED'],
  SUSPENDED: ['ENROLLED', 'DROPPED'],
  DROPPED: ['ENROLLED'],
  GRADUATED: [],
};

/** Igual que el @MaxLength de las observaciones en el backend. */
export const OBSERVATIONS_MAX = 2000;
