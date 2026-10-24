import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation } from 'react-router';
import { toast } from 'sonner';
import { z } from '@/lib/zod';
import { errorMessage } from '@/api/errors';
import { useSession } from '@/auth/session';
import { Field } from '@/components/form/field';
import { IconInput, PasswordInput } from '@/components/form/inputs';
import { ImageUpload } from '@/components/image-upload';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { ChangePasswordForm } from '@/features/auth/change-password-form';
import { PageHeader } from '@/features/layout/page-header';
import {
  useChangeEmail,
  useMyAvatar,
  useRemoveAvatar,
  useResendVerification,
  useUploadAvatar,
} from './profile-api';

export function ProfilePage() {
  const { data: session } = useSession();
  const { hash } = useLocation();
  const passwordRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (hash === '#password') passwordRef.current?.scrollIntoView({ block: 'start' });
  }, [hash]);

  if (!session) return null;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Mi perfil" description="Tu foto, tu correo y tu contraseña." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Foto de perfil">
          <AvatarSection />
        </Section>
        <Section title="Correo">
          <EmailSection />
        </Section>
        <Section title="Contraseña" id="password" sectionRef={passwordRef}>
          <p className="-mt-2 text-muted-foreground">
            Al cambiarla cerramos tus sesiones en otros dispositivos.
          </p>
          <ChangePasswordForm onDone={() => toast.success('Contraseña cambiada.')} />
        </Section>
      </div>
    </div>
  );
}

function AvatarSection() {
  const { data: session } = useSession();
  const { data: avatar } = useMyAvatar();
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  if (!session) return null;
  const { user } = session;

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <UserAvatar
        firstName={user.firstName}
        lastName={user.lastName}
        url={avatar?.url}
        className="size-24 text-2xl"
      />
      <ImageUpload
        noun="foto"
        hasImage={user.hasAvatar}
        uploading={upload.isPending}
        removing={remove.isPending}
        onFile={(file) => {
          upload.mutate(file, {
            onSuccess: () => toast.success('Foto actualizada.'),
            onError: (error) => toast.error(errorMessage(error)),
          });
        }}
        onRemove={() => {
          remove.mutate(undefined, {
            onSuccess: () => toast.success('Foto quitada.'),
            onError: (error) => toast.error(errorMessage(error)),
          });
        }}
      />
    </div>
  );
}

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Escribe el correo nuevo.')
    .max(255)
    .pipe(z.email('Escribe un correo válido, como ana@colegio.edu.co.')),
  currentPassword: z.string().min(1, 'Escribe tu contraseña actual.').max(72),
});
type EmailValues = z.infer<typeof emailSchema>;

function EmailSection() {
  const { data: session } = useSession();
  const change = useChangeEmail();
  const resend = useResendVerification();
  const form = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', currentPassword: '' },
  });
  if (!session) return null;
  const { user } = session;
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    change.mutate(values, {
      onSuccess: () => {
        form.reset();
        toast.success('Te enviamos un enlace al correo nuevo para confirmarlo.');
      },
    });
  });

  return (
    <>
      <div className="flex flex-col gap-2">
        <p>
          <span className="text-muted-foreground">Correo actual: </span>
          <span className="font-bold break-all">{user.email ?? 'sin correo'}</span>
        </p>
        {user.email && !user.emailVerified && (
          <Alert>
            Tu correo no está verificado. Sin verificarlo no puedes recuperar la contraseña por
            correo.
          </Alert>
        )}
        {user.pendingEmail && (
          <Alert>
            Falta confirmar <strong className="break-all">{user.pendingEmail}</strong>. Abre el
            enlace que te enviamos a ese correo.
          </Alert>
        )}
        {(user.pendingEmail ?? (user.email && !user.emailVerified)) && (
          <Button
            variant="link"
            className="self-start"
            disabled={resend.isPending}
            onClick={() => {
              resend.mutate(undefined, {
                onSuccess: () => toast.success('Enlace reenviado. Puedes pedir otro en 2 minutos.'),
                onError: (error) => toast.error(errorMessage(error)),
              });
            }}
          >
            Reenviar enlace de confirmación
          </Button>
        )}
      </div>
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
        {change.isError && <Alert variant="error">{errorMessage(change.error)}</Alert>}
        <Field label="Correo nuevo" error={errors.email?.message}>
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
        <Field label="Contraseña actual" error={errors.currentPassword?.message}>
          {(control) => (
            <PasswordInput
              autoComplete="current-password"
              {...control}
              {...form.register('currentPassword')}
            />
          )}
        </Field>
        <Button type="submit" className="self-start" disabled={change.isPending}>
          {change.isPending ? 'Enviando…' : 'Cambiar correo'}
        </Button>
      </form>
    </>
  );
}
