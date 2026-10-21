import { zodResolver } from '@hookform/resolvers/zod';
import { ImageUp, Mail, Trash2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { useSession } from '@/auth/session';
import { Field } from '@/components/form/field';
import { IconInput, PasswordInput } from '@/components/form/inputs';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { ChangePasswordForm } from '@/features/auth/change-password-form';
import { PageHeader } from '@/features/layout/page-header';
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
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

function Section({
  title,
  id,
  sectionRef,
  children,
}: {
  title: string;
  id?: string;
  sectionRef?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      ref={sectionRef}
      aria-label={title}
      className="flex scroll-mt-24 flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-7"
    >
      <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function AvatarSection() {
  const { data: session } = useSession();
  const { data: avatar } = useMyAvatar();
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const input = useRef<HTMLInputElement>(null);
  if (!session) return null;
  const { user } = session;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error('Usa una imagen JPG, PNG o WEBP.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error('La imagen pesa más de 2 MB. Elige una más liviana.');
      return;
    }
    upload.mutate(file, {
      onSuccess: () => toast.success('Foto actualizada.'),
      onError: (error) => toast.error(errorMessage(error)),
    });
  };

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <UserAvatar
        firstName={user.firstName}
        lastName={user.lastName}
        url={avatar?.url}
        className="size-24 text-2xl"
      />
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">JPG, PNG o WEBP de máximo 2 MB.</p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept={AVATAR_TYPES.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button
            variant="outline"
            disabled={upload.isPending}
            onClick={() => input.current?.click()}
          >
            <ImageUp aria-hidden="true" />
            {upload.isPending ? 'Subiendo…' : user.hasAvatar ? 'Cambiar foto' : 'Subir foto'}
          </Button>
          {user.hasAvatar && (
            <Button
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => {
                remove.mutate(undefined, {
                  onSuccess: () => toast.success('Foto quitada.'),
                  onError: (error) => toast.error(errorMessage(error)),
                });
              }}
            >
              <Trash2 aria-hidden="true" />
              Quitar foto
            </Button>
          )}
        </div>
      </div>
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
