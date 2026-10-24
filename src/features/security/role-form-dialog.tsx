import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from '@/lib/zod';
import { errorMessage } from '@/api/errors';
import type { Role } from '@/api/types';
import { Field } from '@/components/form/field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogContent } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';

// Las mismas reglas que CreateRoleDto.
const schema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del rol.').max(100, 'Máximo 100 caracteres.'),
  description: z
    .string()
    .trim()
    .max(1000, 'Máximo 1000 caracteres.')
    .transform((value) => value || null),
});
type FormInput = z.input<typeof schema>;
export type RoleFormValues = z.output<typeof schema>;

const FORM_ID = 'role-form';

/** Nombre y descripción de un rol (crear o editar). Va dentro de un <Dialog>. */
export function RoleFormDialog({
  role,
  pending,
  error,
  onSubmit,
}: {
  role?: Role;
  pending: boolean;
  error: unknown;
  onSubmit: (values: RoleFormValues) => void;
}) {
  const form = useForm<FormInput, unknown, RoleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: role?.name ?? '', description: role?.description ?? '' },
  });
  const { errors } = form.formState;
  return (
    <DialogContent
      title={role ? 'Editar rol' : 'Nuevo rol'}
      description={role ? undefined : 'Después de crearlo eliges qué puede ver y hacer.'}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={FORM_ID} disabled={pending}>
            {pending ? 'Guardando…' : role ? 'Guardar cambios' : 'Crear rol'}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
        className="flex flex-col gap-5"
      >
        {error !== null && error !== undefined && (
          <Alert variant="error">{errorMessage(error)}</Alert>
        )}
        <Field label="Nombre" error={errors.name?.message}>
          {(control) => <Input autoComplete="off" {...control} {...form.register('name')} />}
        </Field>
        <Field label="Descripción (opcional)" error={errors.description?.message}>
          {(control) => <Textarea rows={3} {...control} {...form.register('description')} />}
        </Field>
      </form>
    </DialogContent>
  );
}
