import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  // Un texto largo (rol · sede) se parte en varias líneas antes que salirse.
  'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-bold break-words',
  {
    variants: {
      variant: {
        neutral: 'bg-muted text-muted-foreground',
        active: 'bg-level-alto text-level-alto-foreground',
        inactive: 'border border-rule bg-card text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Estado activo/inactivo siempre con texto (no solo color). */
export function StatusBadge({
  active,
  labels = ['Activa', 'Inactiva'],
}: {
  active: boolean;
  /** Para sustantivos masculinos: ['Activo', 'Inactivo']. */
  labels?: readonly [string, string];
}) {
  return (
    <Badge variant={active ? 'active' : 'inactive'} className="whitespace-nowrap">
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', active ? 'bg-success' : 'bg-muted-foreground')}
      />
      {active ? labels[0] : labels[1]}
    </Badge>
  );
}
