import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from '@/lib/zod';
import { errorMessage } from '@/api/errors';
import { useChangePassword } from '@/auth/session';
import { Field } from '@/components/form/field';
import { PasswordInput } from '@/components/form/inputs';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MISMATCH, newPasswordFields, passwordsMatch } from '@/lib/password-policy';
import { PasswordChecklist } from './password-checklist';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Escribe tu contraseña actual.').max(72),
    ...newPasswordFields,
  })
  .refine(passwordsMatch, MISMATCH)
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'La contraseña nueva debe ser distinta de la actual.',
    path: ['newPassword'],
  });
type Values = z.infer<typeof schema>;

/** Formulario de cambio de contraseña (obligatorio tras una temporal o desde el perfil). */
export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const change = useChangePassword();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const { errors } = form.formState;
  const newPassword = useWatch({ control: form.control, name: 'newPassword' });
  const onSubmit = form.handleSubmit((values) => {
    change.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          form.reset();
          onDone?.();
        },
      },
    );
  });

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
      {change.isError && <Alert variant="error">{errorMessage(change.error)}</Alert>}
      <Field label="Contraseña actual" error={errors.currentPassword?.message}>
        {(control) => (
          <PasswordInput
            autoComplete="current-password"
            {...control}
            {...form.register('currentPassword')}
          />
        )}
      </Field>
      <Field
        label="Contraseña nueva"
        error={errors.newPassword?.message}
        hint={<PasswordChecklist value={newPassword} />}
      >
        {(control) => (
          <PasswordInput
            autoComplete="new-password"
            {...control}
            {...form.register('newPassword')}
          />
        )}
      </Field>
      <Field label="Repite la contraseña nueva" error={errors.confirmPassword?.message}>
        {(control) => (
          <PasswordInput
            autoComplete="new-password"
            {...control}
            {...form.register('confirmPassword')}
          />
        )}
      </Field>
      <Button type="submit" size="lg" disabled={change.isPending}>
        {change.isPending ? 'Guardando…' : 'Cambiar contraseña'}
      </Button>
    </form>
  );
}
