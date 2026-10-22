import type { Campus, Institution, ManagedUser, MenuOptionNode, RoleDetail } from '@/api/types';

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

export const role = (overrides: Partial<RoleDetail> = {}): RoleDetail => ({
  id: '3f1d2c4b-5a6e-4f70-8a9b-0c1d2e3f4a5b',
  institutionId: 'inst-1',
  isGlobal: false,
  name: 'Coordinación académica',
  description: 'Coordina cursos y docentes.',
  createdAt: '2026-01-01T00:00:00Z',
  permissions: [],
  ...overrides,
});

export const managedUser = (overrides: Partial<ManagedUser> = {}): ManagedUser => ({
  id: '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d',
  userType: 'INSTITUTION_ADMIN',
  documentType: 'CC',
  documentNumber: '1020304050',
  firstName: 'Carlos',
  lastName: 'Ruiz',
  email: 'carlos@colegio.edu.co',
  emailVerified: true,
  hasPendingEmail: false,
  pendingEmail: null,
  phone: null,
  hasAvatar: false,
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
  assignments: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

export const menuOption = (
  id: string,
  name: string,
  children: MenuOptionNode[] = [],
  overrides: Partial<MenuOptionNode> = {},
): MenuOptionNode => ({
  id,
  parentId: null,
  name,
  slug: id,
  icon: null,
  displayOrder: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  children: children.map((child) => ({ ...child, parentId: id })),
  ...overrides,
});
