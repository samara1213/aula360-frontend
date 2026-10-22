import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { PublicOnly, RequireSession } from '@/auth/guards';
import { FullPageLoader } from '@/components/full-page-state';
import { ChangePasswordPage } from '@/features/auth/force-change-password-page';
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page';
import { LoginPage } from '@/features/auth/login-page';
import { ResetPasswordPage } from '@/features/auth/reset-password-page';
import { SelectInstitutionPage } from '@/features/auth/select-institution-page';
import { VerifyEmailPage } from '@/features/auth/verify-email-page';
import { HomePage } from '@/features/home/home-page';
import { AppLayout } from '@/features/layout/app-layout';
import { ModulePage, RouteErrorPage } from '@/features/layout/status-pages';
import { RequireMenuView, RequireSuperAdmin } from '@/features/menu/route-guards';
import { ProfilePage } from '@/features/profile/profile-page';

// Las pantallas de seguridad (roles, menús y usuarios) van juntas en un archivo diferido.
const security = () => import('@/features/security/security-routes');
// Docentes y estudiantes, en otro.
const people = () => import('@/features/people/people-routes');
// Académico, en otro.
const academic = () => import('@/features/academic/academic-routes');

export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    // Al abrir directamente una ruta diferida (lazy), mientras llega su código.
    hydrateFallbackElement: <FullPageLoader />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/reset-password', element: <ResetPasswordPage /> },
        ],
      },
      // Con o sin sesión: el enlace del correo puede abrirse en otro dispositivo.
      { path: '/verify-email', element: <VerifyEmailPage /> },
      {
        // Sin sesión, cualquier otra ruta lleva al login (y vuelve después).
        element: <RequireSession />,
        children: [
          { path: '/change-password', element: <ChangePasswordPage /> },
          { path: '/select-institution', element: <SelectInstitutionPage /> },
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <HomePage /> },
              { path: '/profile', element: <ProfilePage /> },
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
              // Opciones del menú sin pantalla todavía (`academic.courses` → /academic/courses) y 404.
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
