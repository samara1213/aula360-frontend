import { http, HttpResponse } from 'msw';
import type { MenuNode, MenuPermissions, Session } from '@/api/types';
import { makeSession } from './render';
import { server } from './server';

export const apiUrl = (path: string) => new URL(path, window.location.origin).toString();

export const FULL: MenuPermissions = { view: true, create: true, update: true, delete: true };
export const NO_ACCESS: MenuPermissions = {
  view: false,
  create: false,
  update: false,
  delete: false,
};
export const VIEW_ONLY: MenuPermissions = {
  view: true,
  create: false,
  update: false,
  delete: false,
};

/** Por defecto, los permisos valen en toda la institución (institutionWide igual). */
export function menuNode(
  slug: string,
  name: string,
  permissions: MenuPermissions = FULL,
  children: MenuNode[] = [],
  institutionWide: MenuPermissions = permissions,
): MenuNode {
  return {
    id: `m-${slug}`,
    slug,
    name,
    icon: null,
    displayOrder: 0,
    permissions,
    institutionWide,
    children,
  };
}

/**
 * Grupo «Institución» con «Sedes», con los permisos que se pidan. Con
 * `siteOnly`, esos permisos son de un rol limitado a una sede (en toda la
 * institución no tiene ninguno).
 */
export function institutionMenu(
  group: MenuPermissions = FULL,
  campuses: MenuPermissions = FULL,
  { siteOnly = false }: { siteOnly?: boolean } = {},
): MenuNode[] {
  const wide = (perms: MenuPermissions) => (siteOnly ? NO_ACCESS : perms);
  return [
    menuNode(
      'institution',
      'Institución',
      group,
      [menuNode('institution.campuses', 'Sedes', campuses, [], wide(campuses))],
      wide(group),
    ),
  ];
}

/** Sesión iniciada con su menú (sin renovación: la sesión no vence en la prueba). */
export function mockSignedIn(session: Session = makeSession(), menu: MenuNode[] = []) {
  server.use(
    http.get(apiUrl('/api/auth/me'), () => HttpResponse.json(session)),
    http.get(apiUrl('/api/menu-options/my-menu'), () => HttpResponse.json(menu)),
    // Sin invitaciones de otras instituciones, salvo que la prueba registre otras.
    http.get(apiUrl('/api/users/me/invitations'), () => HttpResponse.json([])),
  );
}

export const superAdminSession = () =>
  makeSession({
    activeInstitutionId: null,
    institutions: [],
    user: { userType: 'SUPER_ADMIN', firstName: 'Fabio', lastName: 'Díaz' },
  });

export function page<T>(data: T[], page = 1, limit = 20, total = data.length) {
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export function apiError(status: number, message: string, code?: string) {
  return HttpResponse.json({ statusCode: status, message, ...(code && { code }) }, { status });
}

/**
 * Grupo «Seguridad» (roles, menús y usuarios). Con `siteOnly`, los permisos
 * son de un rol limitado a una sede (en toda la institución, ninguno).
 */
export function securityMenu(
  permissions: MenuPermissions = FULL,
  { siteOnly = false }: { siteOnly?: boolean } = {},
): MenuNode[] {
  const wide = siteOnly ? NO_ACCESS : permissions;
  const leaf = (slug: string, name: string) => menuNode(slug, name, permissions, [], wide);
  return [
    menuNode(
      'security',
      'Seguridad',
      permissions,
      [
        leaf('security.roles', 'Roles'),
        leaf('security.menu-options', 'Menús'),
        leaf('security.users', 'Usuarios'),
      ],
      wide,
    ),
  ];
}

/**
 * Grupo «Personas» (docentes y estudiantes), «Institución → Sedes» (para
 * elegir la sede; por defecto solo ver) y, si se pide, «Seguridad →
 * Usuarios» (activar, desactivar y contraseña temporal). Con `siteOnly`, los
 * permisos de Personas son de un rol limitado a una sede.
 */
export function peopleMenu(
  permissions: MenuPermissions = FULL,
  {
    siteOnly = false,
    users = NO_ACCESS,
    campuses = VIEW_ONLY,
  }: { siteOnly?: boolean; users?: MenuPermissions; campuses?: MenuPermissions } = {},
): MenuNode[] {
  const wide = siteOnly ? NO_ACCESS : permissions;
  const leaf = (slug: string, name: string) => menuNode(slug, name, permissions, [], wide);
  return [
    menuNode(
      'people',
      'Personas',
      permissions,
      [leaf('people.teachers', 'Docentes'), leaf('people.students', 'Estudiantes')],
      wide,
    ),
    menuNode('security', 'Seguridad', users, [menuNode('security.users', 'Usuarios', users)]),
    menuNode('institution', 'Institución', campuses, [
      menuNode('institution.campuses', 'Sedes', campuses),
    ]),
  ];
}

/**
 * Grupo «Académico» (años, periodos, grados, materias, niveles, cursos, carga y
 * matrículas). Con
 * `siteOnly`, los permisos son de un rol limitado a una sede (en toda la
 * institución, ninguno).
 */
export function academicMenu(
  permissions: MenuPermissions = FULL,
  { siteOnly = false }: { siteOnly?: boolean } = {},
): MenuNode[] {
  const wide = siteOnly ? NO_ACCESS : permissions;
  const leaf = (slug: string, name: string) => menuNode(slug, name, permissions, [], wide);
  return [
    menuNode(
      'academic',
      'Académico',
      permissions,
      [
        leaf('academic.years', 'Años lectivos'),
        leaf('academic.periods', 'Periodos'),
        leaf('academic.grades', 'Grados'),
        leaf('academic.subjects', 'Materias'),
        leaf('academic.performance-levels', 'Niveles de desempeño'),
        leaf('academic.courses', 'Cursos'),
        leaf('academic.teacher-assignments', 'Carga académica'),
        leaf('academic.enrollments', 'Matrículas'),
      ],
      wide,
    ),
  ];
}

/**
 * Grupo «Evaluaciones» (evaluaciones y notas). Por defecto, como el rol
 * TEACHER: evaluaciones con todo y notas sin borrar.
 */
export function evaluationsMenu(
  evaluations: MenuPermissions = FULL,
  scores: MenuPermissions = { view: true, create: true, update: true, delete: false },
): MenuNode[] {
  return [
    menuNode('evaluations', 'Evaluaciones', VIEW_ONLY, [
      menuNode('evaluations.evaluations', 'Evaluaciones', evaluations),
      menuNode('evaluations.scores', 'Notas', scores),
    ]),
  ];
}

/** Grupo «Reportes» con «Boletines», con los permisos que se pidan. */
export function reportsMenu(permissions: MenuPermissions = FULL): MenuNode[] {
  return [
    menuNode('reports', 'Reportes', VIEW_ONLY, [
      menuNode('reports.report-cards', 'Boletines', permissions),
    ]),
  ];
}
