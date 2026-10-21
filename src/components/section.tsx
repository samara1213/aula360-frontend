import type { ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils';

/** Bloque con título dentro de una página (perfil, institución...). */
export function Section({
  title,
  description,
  actions,
  id,
  sectionRef,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  /** Botones a la derecha del título. */
  actions?: ReactNode;
  id?: string;
  sectionRef?: Ref<HTMLElement>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      ref={sectionRef}
      aria-label={title}
      className={cn(
        'flex scroll-mt-24 flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-7',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
