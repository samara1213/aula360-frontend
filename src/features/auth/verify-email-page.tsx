import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { api, unwrap } from '@/api/client';
import { errorSentence } from '@/api/errors';
import { SESSION_KEY } from '@/auth/session';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AuthCard, AuthHeading, AuthLayout } from './auth-layout';
import { useHashToken } from './hash-token';

/** Abre el enlace del correo: funciona con o sin sesión (puede ser otro dispositivo). */
export function VerifyEmailPage() {
  const token = useHashToken();
  const queryClient = useQueryClient();
  const verify = useMutation({
    mutationFn: (value: string) =>
      unwrap(api.POST('/api/auth/verify-email', { body: { token: value } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
  });

  // Un solo intento: el token es de un uso (StrictMode monta los efectos dos veces).
  const { mutate } = verify;
  const sent = useRef(false);
  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    mutate(token);
  }, [token, mutate]);

  let body;
  if (!token) {
    body = (
      <Alert variant="error">
        El enlace está incompleto. Ábrelo de nuevo desde el correo o pide otro desde tu perfil.
      </Alert>
    );
  } else if (verify.isSuccess) {
    body = (
      <Alert variant="success">
        Tu correo quedó confirmado. Ya puedes usarlo para ingresar y recuperar tu contraseña.
      </Alert>
    );
  } else if (verify.isError) {
    body = (
      <Alert variant="error">
        {errorSentence(verify.error)} Si el enlace venció o ya lo usaste, pide otro desde tu perfil.
      </Alert>
    );
  } else {
    body = <Alert>Confirmando tu correo…</Alert>;
  }

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeading title="Confirmación de correo" />
        {body}
        <Button asChild size="lg" variant={verify.isSuccess ? 'default' : 'outline'}>
          <Link to="/">Ir a Aula360</Link>
        </Button>
      </AuthCard>
    </AuthLayout>
  );
}
