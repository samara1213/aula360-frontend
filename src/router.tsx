import { createBrowserRouter, type RouteObject } from 'react-router';
import { PublicOnly, RequireSession } from '@/auth/guards';
import { ChangePasswordPage } from '@/features/auth/force-change-password-page';
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page';
import { LoginPage } from '@/features/auth/login-page';
import { ResetPasswordPage } from '@/features/auth/reset-password-page';
import { SelectInstitutionPage } from '@/features/auth/select-institution-page';
import { VerifyEmailPage } from '@/features/auth/verify-email-page';
import { HomePage } from '@/features/home/home-page';
import { AppLayout } from '@/features/layout/app-layout';
import { ModulePage, RouteErrorPage } from '@/features/layout/status-pages';
import { ProfilePage } from '@/features/profile/profile-page';

export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
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
              // Opciones del menú (`academic.periods` → /academic/periods) y 404.
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
