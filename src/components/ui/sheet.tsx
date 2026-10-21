import { X } from 'lucide-react';
import { Dialog as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const Sheet = Primitive.Root;
export const SheetTrigger = Primitive.Trigger;
export const SheetClose = Primitive.Close;
export const SheetTitle = Primitive.Title;
export const SheetDescription = Primitive.Description;

/** Panel deslizable desde la izquierda (menú en celular y tablet). */
export function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-[#0a0f26]/55 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <Primitive.Content
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] flex-col bg-sidebar text-sidebar-foreground shadow-2xl',
          'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left',
          className,
        )}
        {...props}
      >
        {children}
        <Primitive.Close
          className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
          aria-label="Cerrar menú"
        >
          <X className="size-5" aria-hidden="true" />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
