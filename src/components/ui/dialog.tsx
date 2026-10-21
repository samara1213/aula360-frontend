import { X } from 'lucide-react';
import { Dialog as Primitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

/**
 * Ventana modal: centrada desde tablet; en celular sube desde abajo y ocupa el
 * ancho. El contenido largo se desplaza dentro (el pie queda visible).
 */
export function DialogContent({
  className,
  title,
  description,
  children,
  footer,
  ...props
}: Omit<ComponentProps<typeof Primitive.Content>, 'title'> & {
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-[#0a0f26]/55 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <Primitive.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border border-border bg-card text-card-foreground shadow-2xl outline-none',
          'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(92vw,560px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95',
          className,
        )}
        // Sin descripción, sin aria-describedby (Radix avisaría de un id vacío).
        {...(description ? {} : { 'aria-describedby': undefined })}
        {...props}
      >
        <div className="flex items-start gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
          <div className="min-w-0 flex-1">
            <Primitive.Title className="text-xl font-extrabold tracking-tight">
              {title}
            </Primitive.Title>
            {description && (
              <Primitive.Description className="mt-1 text-muted-foreground">
                {description}
              </Primitive.Description>
            )}
          </div>
          <Primitive.Close
            className="-mt-1.5 -mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-accent focus-visible:ring-4 focus-visible:ring-ring/25"
            aria-label="Cerrar"
          >
            <X className="size-5" aria-hidden="true" />
          </Primitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            {footer}
          </div>
        )}
      </Primitive.Content>
    </Primitive.Portal>
  );
}
