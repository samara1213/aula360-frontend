import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type IconInputProps = ComponentProps<'input'> & { icon: LucideIcon };

/** Campo con ícono a la izquierda. */
export function IconInput({ icon: Icon, className, ...props }: IconInputProps) {
  return (
    <div className="relative">
      <Icon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
      />
      <Input className={cn('pl-11.5', className)} {...props} />
    </div>
  );
}

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type'> & { icon?: LucideIcon };

/** Contraseña con botón para mostrarla u ocultarla. */
export function PasswordInput({ icon: Icon, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      {Icon && (
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
        />
      )}
      <Input
        type={visible ? 'text' : 'password'}
        className={cn('pr-13', Icon && 'pl-11.5', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => {
          setVisible((v) => !v);
        }}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
      >
        {visible ? (
          <EyeOff className="size-5" aria-hidden="true" />
        ) : (
          <Eye className="size-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
