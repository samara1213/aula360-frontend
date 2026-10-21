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
                ],
              },
              // Opciones del menú sin pantalla todavía (`academic.periods` → /academic/periods) y 404.
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
