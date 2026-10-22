import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, KeyRound, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError, errorMessage } from '@/api/errors';
import type { ManagedUser, MenuPermissions, UpdateUserBody, UserAssignment } from '@/api/types';
import { useSession } from '@/auth/session';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Field } from '@/components/form/field';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/features/layout/page-header';
import { NotFoundPage } from '@/features/layout/status-pages';
import { usePermissions } from '@/features/menu/menu';
import { formatDate } from '@/lib/format';
import { roleLabel, userTypeLabel } from '@/lib/roles';
import { useAssignmentOptions } from './assignment-options';
import { TemporaryPasswordPanel } from './temporary-password';
import { PersonalDataFields } from './user-form';
import { personalDataSchema, type PersonalData } from './user-schema';
import {
  useCreateAssignment,
  useDeleteAssignment,
  useResetTemporaryPassword,
  useSetUserActive,
  useUpdateUser,
  useUser,
  type UsersScope,
  validIds,
} from './users-api';

const MALE: readonly [string, string] = ['Activo', 'Inactivo'];
const ALL: MenuPermissions = { view: true, create: true, update: true, delete: true };

/** Lo que se ofrece hacer: el SUPER_ADMIN todo; en la institución, el permiso `security.users`. */
function useUserPermissions(scope: UsersScope): MenuPermissions {
  const permissions = usePermissions('security.users');
  return scope.kind === 'system' ? ALL : permissions;
}

/** Ficha de un usuario: /security/users/:id y /admin/institutions/:id/users/:userId. */
export function UserDetail({
  scope,
  id,
  back,
}: {
  scope: UsersScope;
  id: string;
  back: { to: string; label: string };
}) {
  const { data: user, isPending, error, refetch } = useUser(scope, id);
  return (
    <div className="flex flex-col gap-6">
      <Link
        to={back.to}
        className="inline-flex min-h-11 items-center gap-1 self-start rounded-md font-bold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/25"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
        {back.label}
      </Link>
      {!validIds(scope, id) ? (
        <NotFoundPage />
      ) : isPending ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <Skeleton className="h-10 w-2/3 max-w-md" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : error ? (
        error instanceof ApiError && (error.status === 404 || error.status === 400) ? (
          <NotFoundPage />
        ) : (
          <Alert variant="error">
            No pudimos cargar el usuario.{' '}
            <button
              type="button"
              className="cursor-pointer font-bold text-primary underline"
              onClick={() => void refetch()}
            >
              Reintentar
            </button>
          </Alert>
        )
      ) : (
        <UserFile
          key={`${scope.kind === 'system' ? scope.institutionId : 'activa'}:${user.id}`}
          scope={scope}
          user={user}
        />
      )}
    </div>
  );
}

type Confirming = 'status' | 'password' | null;

function UserFile({ scope, user }: { scope: UsersScope; user: ManagedUser }) {
  const { data: session } = useSession();
  const can = useUserPermissions(scope);
  // El backend no deja gestionar la propia cuenta desde aquí (para eso, Mi perfil).
  const isSelf = session?.user.id === user.id;
  const setActive = useSetUserActive(scope, user.id);
  const reset = useResetTemporaryPassword(scope, user.id);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const name = `${user.firstName} ${user.lastName}`;
  const canUpdate = can.update && !isSelf;
  // Un SUPER_ADMIN recupera su contraseña por correo; desactivarlo sí se puede.
  const canResetPassword = user.isActive && user.userType !== 'SUPER_ADMIN';

  return (
    <>
      <PageHeader
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge active={user.isActive} labels={MALE} />
            <span>{userTypeLabel(user.userType)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {user.lastLoginAt
                ? `Último ingreso: ${formatDate(user.lastLoginAt)}`
                : 'Todavía no ha entrado'}
            </span>
          </span>
        }
        actions={
          canUpdate && (
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
            </>
          )
        }
      />
      {isSelf && (
        <Alert>
          Es tu propia cuenta: tus datos, tu correo y tu contraseña los cambias desde{' '}
          <Link to="/profile" className="font-bold text-primary underline">
            Mi perfil
          </Link>
          .
        </Alert>
      )}
      {user.mustChangePassword && user.isActive && (
        <Alert>Tiene una contraseña temporal: deberá cambiarla la próxima vez que entre.</Alert>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[3fr_2fr]">
        <Section title="Datos personales">
          <PersonalDataForm scope={scope} user={user} readOnly={!canUpdate} />
        </Section>
        <AssignmentsSection scope={scope} user={user} can={can} isSelf={isSelf} />
      </div>

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
              emailed={user.email !== null}
            />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

const FIELDS = [
  'documentType',
  'documentNumber',
  'firstName',
  'lastName',
  'email',
  'phone',
] as const;

function PersonalDataForm({
  scope,
  user,
  readOnly,
}: {
  scope: UsersScope;
  user: ManagedUser;
  readOnly: boolean;
}) {
  const update = useUpdateUser(scope, user.id);
  const form = useForm<z.input<typeof personalDataSchema>, unknown, PersonalData>({
    resolver: zodResolver(personalDataSchema),
    defaultValues: {
      documentType: user.documentType ?? 'CC',
      documentNumber: user.documentNumber ?? '',
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email ?? '',
      phone: user.phone ?? '',
    },
    disabled: readOnly,
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    // Solo lo que cambió: no se pisa lo que otro editó a la vez.
    const changed: UpdateUserBody = Object.fromEntries(
      FIELDS.filter((key) => values[key] !== user[key]).map((key) => [key, values[key]]),
    );
    if (Object.keys(changed).length === 0) {
      toast.info('No hay cambios para guardar.');
      return;
    }
    update.mutate(changed, { onSuccess: () => toast.success('Datos guardados.') });
  });

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
      {update.isError && <Alert variant="error">{errorMessage(update.error)}</Alert>}
      {user.pendingEmail && (
        <Alert>
          Falta que confirme el correo nuevo{' '}
          <strong className="break-all">{user.pendingEmail}</strong>.
        </Alert>
      )}
      <PersonalDataFields register={form.register} errors={errors} />
      {!readOnly && (
        <Button type="submit" className="self-start" disabled={update.isPending}>
          {update.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      )}
    </form>
  );
}

function AssignmentsSection({
  scope,
  user,
  can,
  isSelf,
}: {
  scope: UsersScope;
  user: ManagedUser;
  can: MenuPermissions;
  isSelf: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<UserAssignment | null>(null);
  const remove = useDeleteAssignment(scope);
  // El backend no deja asignarse ni quitarse roles a uno mismo.
  const canAdd = can.create && !isSelf && user.isActive;
  const canRemove = can.delete && !isSelf;

  return (
    <Section
      title="Roles"
      description="Qué hace en la institución y dónde."
      actions={
        canAdd && (
          <Button
            variant="outline"
            onClick={() => {
              setAdding(true);
            }}
          >
            <Plus aria-hidden="true" />
            Asignar rol
          </Button>
        )
      }
    >
      {user.assignments.length === 0 ? (
        <p className="text-muted-foreground">No tiene roles en esta institución.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {user.assignments.map((assignment) => (
            <li key={assignment.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="font-bold">{roleLabel(assignment.role)}</div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {assignment.campus ? assignment.campus.name : 'Toda la institución'}
                  {assignment.campus && !assignment.campus.isActive && (
                    <Badge variant="inactive">Sede inactiva: no vale</Badge>
                  )}
                </div>
              </div>
              {canRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar el rol ${roleLabel(assignment.role)}`}
                  onClick={() => {
                    setRemoving(assignment);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        {adding && (
          <AssignRoleDialog
            scope={scope}
            userId={user.id}
            name={`${user.firstName} ${user.lastName}`}
            onDone={() => {
              setAdding(false);
            }}
          />
        )}
      </Dialog>
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setRemoving(null);
          }}
          title={`¿Quitar el rol ${roleLabel(removing.role)}?`}
          description={`${user.firstName} deja de tener los permisos de ese rol ${
            removing.campus ? `en «${removing.campus.name}»` : 'en toda la institución'
          }.`}
          confirmLabel="Quitar rol"
          pendingLabel="Quitando…"
          destructive
          pending={remove.isPending}
          onConfirm={() => {
            remove.mutate(removing.id, {
              onSuccess: () => {
                toast.success('Rol quitado.');
                setRemoving(null);
              },
              onError: (err) => toast.error(errorMessage(err)),
            });
          }}
        />
      )}
    </Section>
  );
}

const assignSchema = z.object({
  roleId: z.string().min(1, 'Elige el rol.'),
  campusId: z.string(),
});

/** Asignar un rol (y su sede) a un usuario. Va dentro de un <Dialog>. */
export function AssignRoleDialog({
  scope,
  userId,
  name,
  onDone,
}: {
  scope: UsersScope;
  userId: string;
  name: string;
  onDone: () => void;
}) {
  const options = useAssignmentOptions(scope);
  const create = useCreateAssignment(scope);
  const form = useForm<z.infer<typeof assignSchema>>({
    resolver: zodResolver(assignSchema),
    defaultValues: { roleId: '', campusId: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    if (!options.allowWholeInstitution && !values.campusId) {
      form.setError('campusId', {
        message: 'Elige la sede: solo puedes asignar roles en tus sedes.',
      });
      return;
    }
    create.mutate(
      { userId, roleId: values.roleId, campusId: values.campusId || null },
      {
        onSuccess: () => {
          toast.success('Rol asignado.');
          onDone();
        },
      },
    );
  });

  return (
    <DialogContent
      title="Asignar rol"
      description={`A ${name}.`}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form="assign-role-form" disabled={create.isPending}>
            {create.isPending ? 'Asignando…' : 'Asignar rol'}
          </Button>
        </>
      }
    >
      <form
        id="assign-role-form"
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="flex flex-col gap-5"
      >
        {create.isError && <Alert variant="error">{errorMessage(create.error)}</Alert>}
        <Field label="Rol" error={errors.roleId?.message}>
          {(control) => (
            <NativeSelect {...control} {...form.register('roleId')}>
              <option value="">Elige un rol</option>
              {options.roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        {scope.kind === 'institution' ? (
          <Field label="Dónde" error={errors.campusId?.message}>
            {(control) => (
              <NativeSelect {...control} {...form.register('campusId')}>
                <option value="">
                  {options.allowWholeInstitution ? 'Toda la institución' : 'Elige una sede'}
                </option>
                {options.campuses.map((campus) => (
                  <option key={campus.value} value={campus.value}>
                    {campus.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        ) : (
          <p className="text-sm text-muted-foreground">En toda la institución.</p>
        )}
      </form>
    </DialogContent>
  );
}
