import type { Campus, Institution } from '@/api/types';

export const institution = (overrides: Partial<Institution> = {}): Institution => ({
  id: 'inst-1',
  nit: '900123456-7',
  name: 'Colegio San José',
  logoPath: null,
  logoUrl: null,
  gradingScaleMin: 1,
  gradingScaleMax: 5,
  passingScore: 3,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

export const campus = (overrides: Partial<Campus> = {}): Campus => ({
  id: 'c-1',
  institutionId: 'inst-1',
  name: 'Sede Principal',
  address: 'Calle 10 # 5-20',
  city: 'Bogotá',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});
