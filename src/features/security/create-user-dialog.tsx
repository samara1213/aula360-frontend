import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { Field } from '@/components/form/field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogContent } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/input';
import { userTypeLabel } from '@/lib/roles';
import { useAssignmentOptions } from './assignment-options';
import { TemporaryPasswordPanel } from './temporary-password';
import { PersonalDataFields } from './user-form';
import { emptyPersonalData, personalDataSchema } from './user-schema';
import { useCreateUser, type UsersScope } from './users-api';

const USER_TYPES = ['INSTITUTION_ADMIN', 'TEACHER', 'STUDENT'] as const;

const schema = personalDataSchema.extend({
  userType: z.enum(USER_TYPES),
  roleId: z.string().min(1, 'Elige el rol.'),
  campusId: z.string(),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const FORM_ID = 'create-user-form';

type Created = { id: string; name: string; password: string; emailed: boolean };

/**
 * Crear un usuario con su primer rol. Al terminar muestra la contraseña
 * temporal (una sola vez) en el mismo diálogo. Va dentro de un <Dialog>.
 */
export function CreateUserDialog({
  scope,
  onDone,
}: {
  scope: UsersScope;
  /** Al cerrar después de crear: el id del usuario nuevo. */
  onDone: (createdId?: string) => void;
}) {
  const create = useCreateUser(scope);
  const options = useAssignmentOptions(scope);
  const [created, setCreated] = useState<Created | null>(null);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...emptyPersonalData,
      userType: 'INSTITUTION_ADMIN',
      roleId: '',
      campusId: '',
    },
  });
  const { errors } = form.formState;

  if (created) {
    return (
      <DialogContent
        title="Usuario creado"
        // Cerrar borra la contraseña de la memoria de la mutación.
        onCloseAutoFocus={() => {
          create.reset();
        }}
        footer={
          <Button
            onClick={() => {
              create.reset();
              onDone(created.id);
            }}
          >
            Listo
          </Button>
        }
      >
        <TemporaryPasswordPanel
          name={created.name}
          password={created.password}
          emailed={created.emailed}
        />
      </DialogContent>
    );
  }

  const onSubmit = form.handleSubmit((values) => {
    if (!options.allowWholeInstitution && !values.campusId) {
      form.setError('campusId', {
        message: 'Elige la sede: solo puedes asignar roles en tus sedes.',
      });
      return;
    }
    create.mutate(
      { ...values, campusId: values.campusId || null },
      {
        onSuccess: (user) => {
          toast.success(`Usuario ${user.firstName} ${user.lastName} creado.`);
          setCreated({
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            password: user.temporaryPassword,
            emailed: user.email !== null,
          });
        },
      },
    );
  });

  return (
    <DialogContent
      title="Nuevo usuario"
      description="Recibe una contraseña temporal que debe cambiar al entrar."
      className="sm:w-[min(92vw,680px)]"
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={FORM_ID} disabled={create.isPending || options.isPending}>
            {create.isPending ? 'Creando…' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="flex flex-col gap-5"
      >
        {create.isError && <Alert variant="error">{errorMessage(create.error)}</Alert>}
        {options.isError && (
          <Alert variant="error">
            No pudimos cargar los roles o las sedes. Cierra y vuelve a intentarlo.
          </Alert>
        )}
        <PersonalDataFields register={form.register} errors={errors} />
        <Field
          label="Tipo de usuario"
          error={errors.userType?.message}
          hint="Los docentes y estudiantes con su ficha completa se crean desde Personas."
        >
          {(control) => (
            <NativeSelect {...control} {...form.register('userType')}>
              {USER_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                  disabled={type === 'INSTITUTION_ADMIN' && !options.canCreateAdmins}
                >
                  {userTypeLabel(type)}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
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
                  {options.allowWholeInstitution ? (
                    <option value="">Toda la institución</option>
                  ) : (
                    <option value="">Elige una sede</option>
                  )}
                  {options.campuses.map((campus) => (
                    <option key={campus.value} value={campus.value}>
                      {campus.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          ) : (
            <p className="self-end pb-3 text-sm text-muted-foreground">
              Con este rol en toda la institución. Sus sedes las asigna después su administrador.
            </p>
          )}
        </div>
      </form>
    </DialogContent>
  );
}
