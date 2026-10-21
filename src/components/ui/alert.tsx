import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const alertVariants = cva('flex gap-3 rounded-xl px-4 py-3.5 text-sm leading-relaxed', {
  variants: {
    variant: {
      info: 'bg-secondary text-secondary-foreground',
      error: 'border border-destructive/40 bg-destructive/10 text-foreground',
      success: 'border border-success/40 bg-level-alto text-level-alto-foreground',
    },
  },
  defaultVariants: { variant: 'info' },
});

const ICONS = { info: Info, error: CircleAlert, success: CircleCheck };

export function Alert({
  className,
  variant,
  children,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  const Icon = ICONS[variant ?? 'info'];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 size-5 shrink-0', variant === 'error' && 'text-destructive')}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
