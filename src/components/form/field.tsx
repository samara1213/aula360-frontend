import { useId, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type FieldControlProps = {
  id: string;
  'aria-invalid': boolean | undefined;
  'aria-describedby': string | undefined;
};

type FieldProps = {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Algo a la derecha de la etiqueta (p. ej. «¿La olvidaste?»). */
  aside?: ReactNode;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
};

/** Etiqueta + control + ayuda + error, enlazados con aria para lectores de pantalla. */
export function Field({ label, error, hint, aside, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error && (
        <p id={errorId} className="text-sm font-bold text-destructive">
          {error}
        </p>
      )}
      {hint && (
        <div id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  );
}
