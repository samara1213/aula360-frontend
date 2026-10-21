import { useState } from 'react';
import { cn } from '@/lib/utils';

type UserAvatarProps = {
  firstName: string;
  lastName: string;
  url?: string | undefined;
  className?: string;
};

/** Foto de perfil (URL firmada) o, si no hay, las iniciales. */
export function UserAvatar({ firstName, lastName, url, className }: UserAvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const initials = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
  const showImage = url !== undefined && failed !== url;
  return (
    <span
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-extrabold text-primary ring-1 ring-border',
        className,
      )}
    >
      {showImage ? (
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => {
            setFailed(url);
          }}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
