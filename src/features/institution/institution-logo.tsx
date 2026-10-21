import { School } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { Institution } from '@/api/types';
import { ImageUpload } from '@/components/image-upload';
import { cn } from '@/lib/utils';
import type { useCurrentLogo } from './institution-api';

/** Logo (URL pública del bucket logos) o, si no hay o no carga, un ícono. */
export function InstitutionLogo({
  url,
  className,
}: {
  url: string | null | undefined;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = typeof url === 'string' && failed !== url;
  return (
    <span
      className={cn(
        'inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card text-primary',
        className,
      )}
    >
      {showImage ? (
        <img
          src={url}
          alt=""
          className="size-full object-contain p-1"
          referrerPolicy="no-referrer"
          onError={() => {
            setFailed(url);
          }}
        />
      ) : (
        <School className="size-1/2" aria-hidden="true" />
      )}
    </span>
  );
}

type LogoMutations = ReturnType<typeof useCurrentLogo>;

/** Vista del logo con los botones para cambiarlo (si se puede). */
export function LogoEditor({
  institution,
  mutations,
  canEdit,
}: {
  institution: Institution;
  mutations: LogoMutations;
  canEdit: boolean;
}) {
  const { upload, remove } = mutations;
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <InstitutionLogo url={institution.logoUrl} className="size-28 rounded-2xl" />
      {canEdit ? (
        <ImageUpload
          noun="logo"
          hasImage={institution.logoPath !== null}
          uploading={upload.isPending}
          removing={remove.isPending}
          onFile={(file) => {
            upload.mutate(file, {
              onSuccess: () => toast.success('Logo actualizado.'),
              onError: (error) => toast.error(errorMessage(error)),
            });
          }}
          onRemove={() => {
            remove.mutate(undefined, {
              onSuccess: () => toast.success('Logo quitado.'),
              onError: (error) => toast.error(errorMessage(error)),
            });
          }}
        />
      ) : (
        <p className="text-muted-foreground">
          {institution.logoPath ? 'Este es el logo de los boletines.' : 'Todavía no hay logo.'}
        </p>
      )}
    </div>
  );
}
