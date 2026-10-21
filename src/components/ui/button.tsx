import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg font-bold whitespace-nowrap transition-[color,background-color,box-shadow] outline-none focus-visible:ring-4 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default:
          'bg-linear-to-b from-primary-hover to-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_8px_20px_-6px_color-mix(in_srgb,var(--primary)_55%,transparent)] hover:from-primary hover:to-primary',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        outline: 'border border-rule bg-card text-foreground hover:bg-accent',
        ghost: 'text-foreground hover:bg-accent',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 text-base',
        sm: 'h-9 rounded-md px-3 text-sm',
        lg: 'h-13 rounded-xl px-6 text-[17px]',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
