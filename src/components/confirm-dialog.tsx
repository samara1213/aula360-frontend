import { AlertDialog as Primitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Qué pasa exactamente si se confirma. */
  description: ReactNode;
  /** El verbo de la acción («Desactivar sede»), nunca «Aceptar». */
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  destructive?: boolean;
  onConfirm: () => void;
};

/**
 * Confirmación de una acción. Queda abierta mientras la acción corre: quien la
 * usa la cierra en onSuccess (y en onError muestra el aviso).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Primitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-50 bg-[#0a0f26]/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Primitive.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(calc(100vw-32px),440px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex flex-col gap-2">
            <Primitive.Title className="text-xl font-extrabold tracking-tight">
              {title}
            </Primitive.Title>
            <Primitive.Description className="text-muted-foreground">
              {description}
            </Primitive.Description>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Primitive.Cancel asChild>
              <Button variant="outline" disabled={pending}>
                Cancelar
              </Button>
            </Primitive.Cancel>
            {/* No es Primitive.Action: esta cerraría el diálogo antes de saber el resultado. */}
            <Button
              variant={destructive ? 'destructive' : 'default'}
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
