import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const inputClasses =
  'h-12 w-full min-w-0 rounded-xl border border-input bg-card px-3.5 text-base text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-2 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/20';

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(inputClasses, className)} {...props} />;
}

export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select data-slot="select" className={cn(inputClasses, 'pr-8', className)} {...props} />;
}
