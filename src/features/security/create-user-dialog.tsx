import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from '@/lib/zod';
import { errorMessage } from '@/api/errors';
import { Field } from '@/components/form/field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogContent } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/input';
import { useAssignmentOptions } from './assignment-options';
import { CreatedAccountContent, type CreatedAccount } from './temporary-password';
import { PersonalDataFields } from './user-form';
import { emptyPersonalData, personalDataSchema } from './user-schema';
import { useCreateUser, type UsersScope } from './users-api';

const schema = personalDataSchema.extend({
  roleId: z.string().min(1, 'Elige el rol.'),
  campusId: z.string(),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const FORM_ID = 'create-user-form';

/**
 * Crear un usuario administrativo con su primer rol. Los docentes y
 * estudiantes se crean desde Personas, con su ficha. Al terminar muestra la
 * contraseña temporal (una sola vez) en el mismo diálogo. Va dentro de un
 * <Dialog>.
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
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...emptyPersonalData,
      roleId: '',
      campusId: '',
    },
  });
  const { errors } = form.formState;

  if (created) {
    return (
      <CreatedAccountContent
        title="Usuario creado"
        created={created}
        discard={() => {
          create.reset();
        }}
        onDone={() => {
          onDone(created.id);
        }}
      />
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
      { ...values, userType: 'INSTITUTION_ADMIN', campusId: values.campusId || null },
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
      description="Personal administrativo. Recibe una contraseña temporal que debe cambiar al entrar."
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
        <Alert>
          Crea aquí al personal administrativo. Los docentes y estudiantes se crean desde Personas,
          con su ficha completa.
        </Alert>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Rol" error={errors.roleId?.message}>
            {(control) => (
              <NativeSelect {...control} {...form.register('roleId')}>
                <option value="">Elige un rol</option>
                {options.staffRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
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
        </div>
      </form>
    </DialogContent>
  );
}
