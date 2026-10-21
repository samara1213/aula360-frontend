import { DropdownMenu as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuGroup = Primitive.Group;
export const DropdownMenuRadioGroup = Primitive.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-56 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-[0_18px_40px_-12px_rgb(15_21_48/0.35)]',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}

const itemClasses =
  "relative flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[15px] outline-none select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]";

export function DropdownMenuItem({
  className,
  variant,
  ...props
}: ComponentProps<typeof Primitive.Item> & { variant?: 'destructive' }) {
  return (
    <Primitive.Item
      className={cn(itemClasses, variant === 'destructive' && 'text-destructive', className)}
      {...props}
    />
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.RadioItem>) {
  return (
    <Primitive.RadioItem className={cn(itemClasses, 'pr-8', className)} {...props}>
      {children}
      <span className="absolute right-3 flex size-2 items-center justify-center">
        <Primitive.ItemIndicator>
          <span className="block size-2 rounded-full bg-primary" />
        </Primitive.ItemIndicator>
      </span>
    </Primitive.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Primitive.Label>) {
  return (
    <Primitive.Label
      className={cn('px-2.5 py-2 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Primitive.Separator>) {
  return (
    <Primitive.Separator className={cn('-mx-1.5 my-1.5 h-px bg-border', className)} {...props} />
  );
}
