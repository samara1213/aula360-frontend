import { Building2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { errorMessage } from '@/api/errors';
import { useLogout, useSession, useSwitchInstitution } from '@/auth/session';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AuthCard, AuthHeading, AuthLayout } from './auth-layout';

const ROLE_NAMES: Record<string, string> = {
  INSTITUTION_ADMIN: 'Administración',
  TEACHER: 'Docente',
  STUDENT: 'Estudiante',
};

/** El usuario pertenece a varias instituciones y debe elegir con cuál trabajar. */
export function SelectInstitutionPage() {
  const { data: session } = useSession();
  const choose = useSwitchInstitution();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeading
          title="¿Dónde vas a trabajar hoy?"
          description="Perteneces a varias instituciones. Puedes cambiar después desde la barra superior."
        />
        {choose.isError && <Alert variant="error">{errorMessage(choose.error)}</Alert>}
        <ul className="flex flex-col gap-2">
          {session?.institutions.map((institution) => (
            <li key={institution.id}>
              <button
                type="button"
                disabled={choose.isPending}
                onClick={() => {
                  choose.mutate(institution.id, {
                    onSuccess: () => void navigate('/', { replace: true }),
                  });
                }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Building2 className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{institution.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {institution.roles.map((r) => ROLE_NAMES[r] ?? r).join(', ')}
                  </span>
                </span>
                <ChevronRight
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
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
