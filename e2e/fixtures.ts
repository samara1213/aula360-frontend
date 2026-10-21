import type { Page, Route } from '@playwright/test';

export const VIEWPORTS = [
  { name: 'celular', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'portatil', width: 1366, height: 768 },
  { name: 'escritorio', width: 1920, height: 1080 },
] as const;

export const THEMES = ['light', 'dark'] as const;

export const SESSION = {
  activeInstitutionId: 'inst-1',
  institutions: [
    { id: 'inst-1', name: 'Institución Educativa San José', roles: ['INSTITUTION_ADMIN'] },
    { id: 'inst-2', name: 'Colegio La Esperanza', roles: ['TEACHER'] },
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
  children: [],
});
const group = (slug: string, name: string, icon: string, children: unknown[]) => ({
  ...leaf(slug, name, icon),
  permissions: perms(false),
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
      return json(route, { statusCode: 404, message: 'No encontrado', error: 'NOT_FOUND' }, 404);
    },
  );
}

export async function setTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript((value) => {
    localStorage.setItem('aula360.theme', value);
  }, theme);
}
