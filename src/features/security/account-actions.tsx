import { DoorOpen, KeyRound, Power, PowerOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { TemporaryPasswordPanel } from './temporary-password';
import {
  useRemoveInstitutionAccess,
  useResetTemporaryPassword,
  useSetUserActive,
  type UsersScope,
} from './users-api';

/** Lo mínimo de la cuenta: sirve para un usuario, un docente o un estudiante. */
export type AccountUser = {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  /** undefined: quien mira no ve el correo (se dice que no se envió). */
  email?: string | null;
  userType?: string;
  /** También está en otra institución: aquí solo se le quita el acceso. */
  sharedElsewhere?: boolean;
};

type Confirming = 'status' | 'password' | null;

/**
 * Botones «Nueva contraseña temporal» y «Activar/Desactivar» con sus
 * confirmaciones. La contraseña se muestra una sola vez y se descarta al
 * cerrar el diálogo. Usa los endpoints de /users (permiso `security.users`):
 * quien llama decide si se muestran. `onChanged`: recargar lo que muestre
 * la cuenta (p. ej. la ficha de un docente).
 */
export function AccountActions({
  scope,
  user,
  onChanged,
  onRemoved,
}: {
  scope: UsersScope;
  user: AccountUser;
  onChanged?: () => void;
  /** Tras quitarle el acceso a la institución: ya no se puede ver su ficha. */
  onRemoved?: () => void;
}) {
  // Su cuenta es de varias instituciones: desactivarla o cambiarle la
  // contraseña es del SUPER_ADMIN. Desde una institución, solo su acceso a ella.
  if (user.sharedElsewhere && scope.kind === 'institution') {
    return <RemoveAccessAction user={user} onRemoved={onRemoved} />;
  }
  return <OwnAccountActions scope={scope} user={user} onChanged={onChanged} />;
}

function OwnAccountActions({
  scope,
  user,
  onChanged,
}: {
  scope: UsersScope;
  user: AccountUser;
  onChanged?: () => void;
}) {
  const setActive = useSetUserActive(scope, user.id);
  const reset = useResetTemporaryPassword(scope, user.id);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const name = `${user.firstName} ${user.lastName}`;
  // Un SUPER_ADMIN recupera su contraseña por correo; desactivarlo sí se puede.
  const canResetPassword = user.isActive && user.userType !== 'SUPER_ADMIN';

  return (
    <>
      {canResetPassword && (
        <Button
          variant="outline"
          onClick={() => {
            setConfirming('password');
          }}
        >
          <KeyRound aria-hidden="true" />
          Nueva contraseña temporal
        </Button>
      )}
      <Button
        variant="outline"
        onClick={() => {
          setConfirming('status');
        }}
      >
        {user.isActive ? <PowerOff aria-hidden="true" /> : <Power aria-hidden="true" />}
        {user.isActive ? 'Desactivar' : 'Activar'}
      </Button>

      <ConfirmDialog
        open={confirming === 'status'}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={user.isActive ? `¿Desactivar a ${name}?` : `¿Activar a ${name}?`}
        description={
          user.isActive
            ? 'No podrá entrar a Aula360 y se cierran sus sesiones abiertas. Sus datos y sus roles se conservan.'
            : 'Vuelve a entrar con su contraseña y los roles que tenía.'
        }
        confirmLabel={user.isActive ? 'Desactivar usuario' : 'Activar usuario'}
        pendingLabel={user.isActive ? 'Desactivando…' : 'Activando…'}
        destructive={user.isActive}
        pending={setActive.isPending}
        onConfirm={() => {
          setActive.mutate(!user.isActive, {
            onSuccess: () => {
              toast.success(user.isActive ? `${name} quedó inactivo.` : `${name} quedó activo.`);
              setConfirming(null);
              onChanged?.();
            },
            onError: (err) => toast.error(errorMessage(err)),
          });
        }}
      />
      <ConfirmDialog
        open={confirming === 'password'}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={`¿Generar una contraseña temporal para ${name}?`}
        description="La contraseña actual deja de servir y se cierran sus sesiones abiertas. Deberá cambiar la nueva al entrar."
        confirmLabel="Generar contraseña"
        pendingLabel="Generando…"
        pending={reset.isPending}
        onConfirm={() => {
          reset.mutate(undefined, {
            onSuccess: () => {
              setConfirming(null);
              onChanged?.();
            },
            onError: (err) => toast.error(errorMessage(err)),
          });
        }}
      />
      <Dialog
        open={reset.data !== undefined}
        onOpenChange={(open) => {
          // Cerrar descarta la contraseña: no se puede volver a ver.
          if (!open) reset.reset();
        }}
      >
        {reset.data && (
          <DialogContent
            title="Contraseña temporal nueva"
            footer={
              <Button
                onClick={() => {
                  reset.reset();
                }}
              >
                Listo
              </Button>
            }
          >
            <TemporaryPasswordPanel
              name={name}
              password={reset.data.temporaryPassword}
              emailed={typeof user.email === 'string'}
            />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

/**
 * «Quitar acceso en esta institución»: deja de entrar a ella de inmediato y
 * conserva su cuenta, su acceso a la otra institución y su historial aquí.
 */
function RemoveAccessAction({ user, onRemoved }: { user: AccountUser; onRemoved?: () => void }) {
  const remove = useRemoveInstitutionAccess(user.id);
  const [confirming, setConfirming] = useState(false);
  const name = `${user.firstName} ${user.lastName}`;
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setConfirming(true);
        }}
      >
        <DoorOpen aria-hidden="true" />
        Quitar acceso en esta institución
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`¿Quitar a ${name} de esta institución?`}
        description={
          <>
            Deja de entrar a esta institución de inmediato. Su cuenta y su acceso a la otra
            institución siguen igual, y aquí se conservan sus notas, cargas y boletines. Si tiene
            cargas académicas o una matrícula vigentes, termínalas en Académico. Para volver a
            agregarlo, usa «Nuevo» con su documento.
          </>
        }
        confirmLabel="Quitar acceso"
        pendingLabel="Quitando…"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.success(`${name} ya no tiene acceso a esta institución.`);
              setConfirming(false);
              onRemoved?.();
            },
            onError: (err) => toast.error(errorMessage(err)),
          });
        }}
      />
    </>
  );
}
