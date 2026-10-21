import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useLogout, useSession } from '@/auth/session';
import { Button } from '@/components/ui/button';
import { AuthCard, AuthHeading, AuthLayout } from './auth-layout';
import { ChangePasswordForm } from './change-password-form';

/** Con contraseña temporal, el cambio obligatorio; si no, el formulario del perfil. */
export function ChangePasswordPage() {
  const { data: session } = useSession();
  if (!session?.user.mustChangePassword) return <Navigate to="/profile#password" replace />;
  return <ForceChangePasswordPage />;
}

/**
 * Cambio obligatorio: el usuario entró con una contraseña temporal. Mientras no
 * la cambie, el backend responde 403 en todo lo demás.
 */
export function ForceChangePasswordPage() {
  const { data: session } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeading
          title={`Hola, ${session?.user.firstName ?? ''}`.trim()}
          description="Entraste con una contraseña temporal. Crea una propia para continuar."
        />
        <ChangePasswordForm
          onDone={() => {
            toast.success('Contraseña cambiada.');
            void navigate('/', { replace: true });
          }}
        />
        <Button
          variant="ghost"
          onClick={() => {
            logout.mutate();
          }}
        >
          Cerrar sesión
        </Button>
      </AuthCard>
    </AuthLayout>
  );
}
