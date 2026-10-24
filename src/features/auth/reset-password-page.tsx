import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from '@/lib/zod';
import { api, unwrap } from '@/api/client';
import { errorSentence } from '@/api/errors';
import { Field } from '@/components/form/field';
import { PasswordInput } from '@/components/form/inputs';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MISMATCH, newPasswordFields, passwordsMatch } from '@/lib/password-policy';
import { AuthCard, AuthHeading, AuthLayout } from './auth-layout';
import { useHashToken } from './hash-token';
import { PasswordChecklist } from './password-checklist';

const schema = z.object(newPasswordFields).refine(passwordsMatch, MISMATCH);
type Values = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const token = useHashToken();
  const reset = useMutation({
    mutationFn: (newPassword: string) =>
      unwrap(api.POST('/api/auth/reset-password', { body: { token: token ?? '', newPassword } })),
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const { errors } = form.formState;
  const newPassword = useWatch({ control: form.control, name: 'newPassword' });
  const onSubmit = form.handleSubmit((values) => {
    reset.mutate(values.newPassword);
  });

  let body;
  if (!token) {
    body = (
      <Alert variant="error">
        El enlace está incompleto. Ábrelo de nuevo desde el correo o pide uno nuevo.
      </Alert>
    );
  } else if (reset.isSuccess) {
    body = (
      <>
        <Alert variant="success">
          Listo, tu contraseña cambió. Por seguridad cerramos tus sesiones abiertas en otros
          dispositivos.
        </Alert>
        <Button asChild size="lg">
          <Link to="/login">Ingresar</Link>
        </Button>
      </>
    );
  } else {
    body = (
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
        {reset.isError && (
          <Alert variant="error">
            {errorSentence(reset.error)} Si el enlace venció o ya lo usaste, pide uno nuevo.
          </Alert>
        )}
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
        <Button type="submit" size="lg" disabled={reset.isPending}>
          {reset.isPending ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </form>
    );
  }

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeading title="Crea una contraseña nueva" />
        {body}
        {!reset.isSuccess && (
          <Link
            to="/forgot-password"
            className="text-center font-bold text-primary underline-offset-3 hover:underline"
          >
            Pedir un enlace nuevo
          </Link>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
