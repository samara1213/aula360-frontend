import { Check, Circle } from 'lucide-react';
import { PASSWORD_RULES } from '@/lib/password-policy';
import { cn } from '@/lib/utils';

/** Requisitos de la contraseña nueva, marcados a medida que se cumplen. */
export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Requisitos de la contraseña">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <li
            key={rule.id}
            className={cn('flex items-center gap-2', ok ? 'text-success' : 'text-muted-foreground')}
          >
            {ok ? (
              <Check className="size-4" strokeWidth={3} aria-hidden="true" />
            ) : (
              <Circle className="size-4" aria-hidden="true" />
            )}
            <span>
              {rule.label}
              <span className="sr-only">{ok ? ': cumplido' : ': pendiente'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
