import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { PublicOnly, RequireSession } from '@/auth/guards';
import { FullPageLoader } from '@/components/full-page-state';
import { SelectInstitutionPage } from '@/features/auth/select-institution-page';
import { HomePage } from '@/features/home/home-page';
import { AppLayout } from '@/features/layout/app-layout';
import { ModulePage, RouteErrorPage } from '@/features/layout/status-pages';
import { RequireMenuView, RequireSuperAdmin } from '@/features/menu/route-guards';

// Login, recuperar y cambiar contraseña y verificar correo, en un archivo diferido.
const auth = () => import('@/features/auth/auth-routes');
// Las pantallas de seguridad (roles, menús y usuarios) van juntas en un archivo diferido.
const security = () => import('@/features/security/security-routes');
// Docentes y estudiantes, en otro.
const people = () => import('@/features/people/people-routes');
// Académico, en otro.
const academic = () => import('@/features/academic/academic-routes');
// Evaluaciones y notas, en otro.
const evaluations = () => import('@/features/evaluations/evaluations-routes');
// Reportes (boletines), en otro.
const reports = () => import('@/features/reports/reports-routes');

export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    // Al abrir directamente una ruta diferida (lazy), mientras llega su código.
    hydrateFallbackElement: <FullPageLoader />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: '/login', lazy: async () => ({ Component: (await auth()).LoginPage }) },
          {
            path: '/forgot-password',
            lazy: async () => ({ Component: (await auth()).ForgotPasswordPage }),
          },
          {
            path: '/reset-password',
            lazy: async () => ({ Component: (await auth()).ResetPasswordPage }),
          },
        ],
      },
      // Con o sin sesión: el enlace del correo puede abrirse en otro dispositivo.
      {
        path: '/verify-email',
        lazy: async () => ({ Component: (await auth()).VerifyEmailPage }),
      },
      {
        // Sin sesión, cualquier otra ruta lleva al login (y vuelve después).
        element: <RequireSession />,
        children: [
          {
            path: '/change-password',
            lazy: async () => ({ Component: (await auth()).ChangePasswordPage }),
          },
          { path: '/select-institution', element: <SelectInstitutionPage /> },
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <HomePage /> },
              {
                path: '/profile',
                lazy: async () => ({
                  Component: (await import('@/features/profile/profile-page')).ProfilePage,
                }),
              },
              {
                path: '/institution',
                element: <RequireMenuView slug="institution" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({
                      Component: (await import('@/features/institution/institution-page'))
                        .InstitutionPage,
                    }),
                  },
                ],
              },
              {
                path: '/institution/campuses',
                element: <RequireMenuView slug="institution.campuses" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({
                      Component: (await import('@/features/institution/campuses-page'))
                        .CampusesPage,
                    }),
                  },
                ],
              },
              {
                path: '/admin',
                element: <RequireSuperAdmin />,
                children: [
                  { index: true, element: <Navigate to="institutions" replace /> },
                  {
                    path: 'institutions',
                    lazy: async () => ({
                      Component: (await import('@/features/admin/institutions-page'))
                        .InstitutionsPage,
                    }),
                  },
                  {
                    path: 'institutions/:id',
                    lazy: async () => ({
                      Component: (await import('@/features/admin/institution-detail-page'))
                        .InstitutionDetailPage,
                    }),
                  },
                  {
                    path: 'institutions/:institutionId/users/:id',
                    lazy: async () => ({ Component: (await security()).InstitutionUserRoute }),
                  },
                  {
                    path: 'global-roles',
                    lazy: async () => ({ Component: (await security()).GlobalRolesRoute }),
                  },
                  {
                    path: 'global-roles/:id',
                    lazy: async () => ({ Component: (await security()).GlobalRoleRoute }),
                  },
                  {
                    path: 'menu-options',
                    lazy: async () => ({ Component: (await security()).AdminMenuOptionsRoute }),
                  },
                ],
              },
              {
                path: '/security/roles',
                element: <RequireMenuView slug="security.roles" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await security()).InstitutionRolesRoute }),
                  },
                  {
                    path: ':id',
                    lazy: async () => ({ Component: (await security()).InstitutionRoleRoute }),
                  },
                ],
              },
              {
                path: '/security/menu-options',
                element: <RequireMenuView slug="security.menu-options" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await security()).MenuOptionsRoute }),
                  },
                ],
              },
              {
                path: '/security/users',
                element: <RequireMenuView slug="security.users" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await security()).UsersRoute }),
                  },
                  {
                    path: ':id',
                    lazy: async () => ({ Component: (await security()).UserRoute }),
                  },
                ],
              },
              {
                path: '/people/teachers',
                element: <RequireMenuView slug="people.teachers" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await people()).TeachersRoute }),
                  },
                  {
                    path: ':id',
                    lazy: async () => ({ Component: (await people()).TeacherRoute }),
                  },
                ],
              },
              {
                path: '/people/students',
                element: <RequireMenuView slug="people.students" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await people()).StudentsRoute }),
                  },
                  {
                    path: ':id',
                    lazy: async () => ({ Component: (await people()).StudentRoute }),
                  },
                ],
              },
              {
                path: '/academic/years',
                element: <RequireMenuView slug="academic.years" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await academic()).YearsRoute }),
                  },
                  {
                    path: ':id',
                    lazy: async () => ({ Component: (await academic()).YearRoute }),
                  },
                ],
              },
              {
                path: '/academic/periods',
                element: <RequireMenuView slug="academic.periods" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await academic()).PeriodsRoute }),
                  },
                ],
              },
              {
                path: '/academic/grades',
                element: <RequireMenuView slug="academic.grades" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await academic()).GradesRoute }),
                  },
                ],
              },
              {
                path: '/academic/subjects',
                element: <RequireMenuView slug="academic.subjects" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await academic()).SubjectsRoute }),
                  },
                ],
              },
              {
                path: '/academic/performance-levels',
                element: <RequireMenuView slug="academic.performance-levels" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await academic()).PerformanceLevelsRoute }),
                  },
                ],
              },
              {
                path: '/academic/courses',
                element: <RequireMenuView slug="academic.courses" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await academic()).CoursesRoute }),
                  },
                  {
                    path: ':id',
                    lazy: async () => ({ Component: (await academic()).CourseRoute }),
                  },
                ],
              },
              {
                path: '/academic/teacher-assignments',
                element: <RequireMenuView slug="academic.teacher-assignments" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await academic()).AssignmentsRoute }),
                  },
                ],
              },
              {
                path: '/academic/enrollments',
                element: <RequireMenuView slug="academic.enrollments" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await academic()).EnrollmentsRoute }),
                  },
                ],
              },
              {
                path: '/evaluations/evaluations',
                element: <RequireMenuView slug="evaluations.evaluations" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await evaluations()).EvaluationsRoute }),
                  },
                ],
              },
              {
                // La planilla exige el permiso de Notas (el backend, el de ver notas).
                path: '/evaluations/evaluations/:id/scores',
                element: <RequireMenuView slug="evaluations.scores" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await evaluations()).ScoreSheetRoute }),
                  },
                ],
              },
              {
                path: '/evaluations/scores',
                element: <RequireMenuView slug="evaluations.scores" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await evaluations()).GradebookRoute }),
                  },
                ],
              },
              {
                path: '/reports/report-cards',
                element: <RequireMenuView slug="reports.report-cards" />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await reports()).ReportCardsRoute }),
                  },
                ],
              },
              // Opciones del menú sin pantalla todavía y 404.
              { path: '/*', element: <ModulePage /> },
            ],
          },
        ],
      },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
