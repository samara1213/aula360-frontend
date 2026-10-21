import type { Page, Route } from '@playwright/test';

export const VIEWPORTS = [
  { name: 'celular', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'portatil', width: 1366, height: 768 },
  { name: 'escritorio', width: 1920, height: 1080 },
] as const;

export const THEMES = ['light', 'dark'] as const;

export const SESSION = {
  activeInstitutionId: '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01',
  institutions: [
    {
      id: '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01',
      name: 'Institución Educativa San José',
      roles: ['INSTITUTION_ADMIN'],
    },
    {
      id: '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e02',
      name: 'Colegio La Esperanza',
      roles: ['TEACHER'],
    },
  ],
  user: {
    id: 'user-1',
    userType: 'INSTITUTION_ADMIN',
    firstName: 'Ana María',
    lastName: 'Pérez Gómez',
    email: 'ana.perez@colegio.edu.co',
    emailVerified: true,
    pendingEmail: null,
    hasAvatar: false,
    mustChangePassword: false,
  },
};

const perms = (all: boolean) => ({ view: true, create: all, update: all, delete: all });
const leaf = (slug: string, name: string, icon: string) => ({
  id: slug,
  slug,
  name,
  icon,
  displayOrder: 0,
  permissions: perms(true),
  institutionWide: perms(true),
  children: [],
});
const group = (slug: string, name: string, icon: string, children: unknown[]) => ({
  ...leaf(slug, name, icon),
  permissions: perms(false),
  institutionWide: perms(false),
  children,
});

export const MENU = [
  group('institution', 'Institución', 'building', [
    leaf('institution.campuses', 'Sedes', 'map-pin'),
  ]),
  group('people', 'Personas', 'contact', [
    leaf('people.teachers', 'Docentes', 'presentation'),
    leaf('people.students', 'Estudiantes', 'graduation-cap'),
  ]),
  group('academic', 'Académico', 'book-open', [
    leaf('academic.years', 'Años lectivos', 'calendar'),
    leaf('academic.periods', 'Periodos', 'calendar-range'),
    leaf('academic.courses', 'Cursos', 'school'),
    leaf('academic.subjects', 'Materias', 'book'),
  ]),
  group('evaluations', 'Evaluaciones', 'clipboard-check', [
    leaf('evaluations.scores', 'Notas', 'pencil'),
  ]),
  group('reports', 'Reportes', 'file-text', [
    leaf('reports.report-cards', 'Boletines', 'file-down'),
  ]),
];

export const SUPER_ADMIN_SESSION = {
  activeInstitutionId: null,
  institutions: [],
  user: {
    ...SESSION.user,
    id: 'admin-1',
    userType: 'SUPER_ADMIN',
    firstName: 'Fabio',
    lastName: 'Díaz',
  },
};

const stamp = { createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:00:00Z' };
const institution = (id: string, name: string, nit: string, isActive = true) => ({
  id,
  name,
  nit,
  logoPath: null,
  logoUrl: null,
  gradingScaleMin: 1,
  gradingScaleMax: 5,
  passingScore: 3,
  isActive,
  ...stamp,
});
const campus = (
  id: string,
  name: string,
  address: string | null,
  city: string | null,
  isActive = true,
) => ({
  id,
  institutionId: '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01',
  name,
  address,
  city,
  isActive,
  ...stamp,
});
const page = (data: unknown[]) => ({
  data,
  meta: { page: 1, limit: 20, total: data.length, totalPages: 1 },
});

/** Respuestas de los GET de las pantallas (la ruta exacta, sin query). */
const GET_DATA: Record<string, unknown> = {
  '/api/institutions/current': institution(
    '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01',
    'Institución Educativa San José',
    '900123456-7',
  ),
  '/api/campuses': page([
    campus('c-1', 'Sede Principal', 'Calle 10 # 5-20', 'Bogotá'),
    campus('c-2', 'Sede Norte — Primaria', 'Carrera 45 # 170-32, barrio San Antonio', 'Bogotá'),
    campus('c-3', 'Sede Rural La Vega', null, 'La Vega, Cundinamarca', false),
  ]),
  '/api/institutions': page([
    institution(
      '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01',
      'Institución Educativa San José',
      '900123456-7',
    ),
    institution('5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e02', 'Colegio La Esperanza', '800765432-1'),
    institution(
      '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e03',
      'Liceo Antiguo del Valle',
      '860001234-5',
      false,
    ),
  ]),
  '/api/institutions/5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01': institution(
    '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01',
    'Institución Educativa San José',
    '900123456-7',
  ),
};

/** Simula la API: con `session` null no hay sesión (401). */
export async function mockApi(page: Page, session: unknown) {
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const unauthorized = { statusCode: 401, message: 'No autorizado', error: 'UNAUTHORIZED' };

  // Solo la API (no los módulos de Vite en /src/api/...).
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me')
        return session ? json(route, session) : json(route, unauthorized, 401);
      if (path === '/api/auth/refresh-token') return json(route, unauthorized, 401);
      if (path === '/api/menu-options/my-menu') return json(route, MENU);
      if (route.request().method() === 'GET' && Object.hasOwn(GET_DATA, path))
        return json(route, GET_DATA[path]);
      return json(route, { statusCode: 404, message: 'No encontrado', error: 'NOT_FOUND' }, 404);
    },
  );
}

export async function setTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript((value) => {
    localStorage.setItem('aula360.theme', value);
  }, theme);
}
