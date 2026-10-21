import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import type { Campus } from '@/api/types';
import { Field } from '@/components/form/field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCreateCampus, useUpdateCampus } from './institution-api';

// Las mismas reglas que CreateCampusDto. Un campo opcional vacío se guarda como null.
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${String(max)} caracteres.`)
    .transform((value) => value || null);

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre de la sede.')
    .max(255, 'Máximo 255 caracteres.'),
  address: optional(255),
  city: optional(100),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const FORM_ID = 'campus-form';

/**
 * Contenido del diálogo para crear (sin `campus`) o editar una sede. Va dentro
 * de un <Dialog>; se monta de nuevo cada vez que se abre.
 */
export function CampusFormDialog({ campus, onDone }: { campus?: Campus; onDone: () => void }) {
  const create = useCreateCampus();
  const update = useUpdateCampus();
  const mutation = campus ? update : create;
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: campus?.name ?? '',
      address: campus?.address ?? '',
      city: campus?.city ?? '',
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((body) => {
    const options = {
      onSuccess: () => {
        toast.success(campus ? 'Sede guardada.' : `Sede «${body.name}» creada.`);
        onDone();
      },
    };
    if (campus) update.mutate({ id: campus.id, body }, options);
    else create.mutate(body, options);
  });

  return (
    <DialogContent
      title={campus ? 'Editar sede' : 'Nueva sede'}
      description={campus ? undefined : 'Las sedes organizan los cursos y los roles por lugar.'}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={FORM_ID} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : campus ? 'Guardar cambios' : 'Crear sede'}
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
        {mutation.isError && <Alert variant="error">{errorMessage(mutation.error)}</Alert>}
        <Field label="Nombre" error={errors.name?.message}>
          {(control) => <Input autoComplete="off" {...control} {...form.register('name')} />}
        </Field>
        <Field label="Dirección (opcional)" error={errors.address?.message}>
          {(control) => (
            <Input autoComplete="street-address" {...control} {...form.register('address')} />
          )}
        </Field>
        <Field label="Ciudad o municipio (opcional)" error={errors.city?.message}>
          {(control) => (
            <Input autoComplete="address-level2" {...control} {...form.register('city')} />
          )}
        </Field>
      </form>
    </DialogContent>
  );
}
