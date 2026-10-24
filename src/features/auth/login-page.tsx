import { zodResolver } from '@hookform/resolvers/zod';
import { LockKeyhole, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from '@/lib/zod';
import { ApiError, errorMessage } from '@/api/errors';
import { useLogin } from '@/auth/session';
import { Field } from '@/components/form/field';
import { IconInput, PasswordInput } from '@/components/form/inputs';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { DOCUMENT_TYPES } from '@/lib/document-types';
import { AuthCard, AuthHeading, AuthLayout } from './auth-layout';

const schema = z.object({
  identifier: z.string().trim().min(1, 'Escribe tu correo o tu número de documento.').max(254),
  documentType: z.string(),
  password: z.string().min(1, 'Escribe tu contraseña.').max(72),
});
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const login = useLogin();
  const [askType, setAskType] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: '', documentType: '', password: '' },
  });
  const { errors } = form.formState;
  const identifier = useWatch({ control: form.control, name: 'identifier' });
  const byDocument = identifier.trim() !== '' && !identifier.includes('@');

  const onSubmit = form.handleSubmit((values) => {
    login.mutate({
      identifier: values.identifier,
      password: values.password,
      ...(byDocument && values.documentType ? { documentType: values.documentType } : {}),
    });
  });

  const failed = login.error;
  const badCredentials = failed instanceof ApiError && failed.status === 401;

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeading
          title="Hola de nuevo"
          description="Entra con tu correo o tu número de documento."
        />
        {failed && (
          <Alert variant="error">
            {badCredentials ? (
              <>
                El usuario o la contraseña no coinciden. Revisa los datos e inténtalo de nuevo.
                {byDocument && !askType && (
                  <>
                    {' '}
                    Si tu número está registrado con más de un tipo de documento,{' '}
                    <button
                      type="button"
                      className="cursor-pointer font-bold text-primary underline underline-offset-3"
                      onClick={() => {
                        setAskType(true);
                      }}
                    >
                      elige el tipo
                    </button>
                    .
                  </>
                )}
              </>
            ) : (
              errorMessage(failed)
            )}
          </Alert>
        )}
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
          <Field label="Correo o documento" error={errors.identifier?.message}>
            {(control) => (
              <IconInput
                icon={UserRound}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                {...control}
                {...form.register('identifier')}
              />
            )}
          </Field>

          {byDocument && askType && (
            <Field label="Tipo de documento">
              {(control) => (
                <NativeSelect {...control} {...form.register('documentType')}>
                  <option value="">Elige el tipo</option>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          )}

          <Field
            label="Contraseña"
            error={errors.password?.message}
            aside={
              <Link
                to="/forgot-password"
                className="text-[15px] font-bold text-primary underline-offset-3 hover:underline"
              >
                ¿La olvidaste?
              </Link>
            }
          >
            {(control) => (
              <PasswordInput
                icon={LockKeyhole}
                autoComplete="current-password"
                {...control}
                {...form.register('password')}
              />
            )}
          </Field>

          <Button type="submit" size="lg" className="mt-1" disabled={login.isPending}>
            {login.isPending ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
        <Alert>
          ¿Primera vez? Tu institución te entrega el usuario y una contraseña temporal. Al entrar te
          pediremos cambiarla.
        </Alert>
      </AuthCard>
    </AuthLayout>
  );
}
