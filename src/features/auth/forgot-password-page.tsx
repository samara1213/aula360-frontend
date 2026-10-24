import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from '@/lib/zod';
import { api, unwrap } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { Field } from '@/components/form/field';
import { IconInput } from '@/components/form/inputs';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AuthCard, AuthHeading, AuthLayout } from './auth-layout';

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Escribe tu correo.')
    .max(255)
    .pipe(z.email('Escribe un correo válido, como ana@colegio.edu.co.')),
});
type Values = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const request = useMutation({
    mutationFn: (body: Values) => unwrap(api.POST('/api/auth/forgot-password', { body })),
  });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } });
  const onSubmit = form.handleSubmit((values) => {
    request.mutate(values);
  });

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeading
          title="Recupera tu contraseña"
          description="Te enviaremos un enlace para crear una nueva. Llega solo si tu correo está verificado en Aula360."
        />
        {request.isSuccess ? (
          <Alert variant="success">
            Si el correo está registrado y verificado, en unos minutos recibirás el enlace. Revisa
            también la carpeta de spam. El enlace vence en 30 minutos.
          </Alert>
        ) : (
          <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
            {request.isError && <Alert variant="error">{errorMessage(request.error)}</Alert>}
            <Field label="Correo" error={form.formState.errors.email?.message}>
              {(control) => (
                <IconInput
                  icon={Mail}
                  type="email"
                  autoComplete="email"
                  {...control}
                  {...form.register('email')}
                />
              )}
            </Field>
            <Button type="submit" size="lg" disabled={request.isPending}>
              {request.isPending ? 'Enviando…' : 'Enviar enlace'}
            </Button>
          </form>
        )}
        <Alert>
          ¿Tu correo no está verificado o no tienes correo? Pide a la secretaría de tu institución
          una contraseña temporal.
        </Alert>
        <Link
          to="/login"
          className="text-center font-bold text-primary underline-offset-3 hover:underline"
        >
          Volver a ingresar
        </Link>
      </AuthCard>
    </AuthLayout>
  );
}
