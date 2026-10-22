import { Copy, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DialogContent } from '@/components/ui/dialog';

/**
 * La contraseña temporal recién generada. Se muestra solo aquí: no se guarda
 * en la caché ni se puede volver a ver (para otra, se genera una nueva).
 */
export function TemporaryPasswordPanel({
  name,
  password,
  emailed,
}: {
  name: string;
  password: string;
  /** Si el usuario tiene correo, el backend también se la envió. */
  emailed: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <p>
        Contraseña temporal de <strong>{name}</strong>. Al entrar, Aula360 le pedirá cambiarla.
      </p>
      <div className="flex flex-col items-stretch gap-3 rounded-2xl border-2 border-dashed border-rule bg-secondary/60 p-4 sm:flex-row sm:items-center">
        <KeyRound className="hidden size-6 shrink-0 text-primary sm:block" aria-hidden="true" />
        <output
          aria-label="Contraseña temporal"
          className="min-w-0 flex-1 font-mono text-xl font-bold tracking-wider break-all select-all"
        >
          {password}
        </output>
        <Button
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(password).then(
              () => toast.success('Contraseña copiada. Pégala y después copia otra cosa.'),
              () => toast.error('No pudimos copiarla. Selecciónala y cópiala a mano.'),
            );
          }}
        >
          <Copy aria-hidden="true" />
          Copiar
        </Button>
      </div>
      <Alert>
        Solo se muestra esta vez.{' '}
        {emailed
          ? 'También se la enviamos a su correo.'
          : 'No tiene correo: entrégasela en persona o por un medio seguro.'}{' '}
        Si se pierde, genera una nueva desde su ficha. Si la copias, pégala donde la necesites y
        después copia otra cosa: el portapapeles (y su historial) la guarda.
      </Alert>
    </div>
  );
}

/** La cuenta recién creada, mientras su diálogo está abierto. */
export type CreatedAccount = { id: string; name: string; password: string; emailed: boolean };

/**
 * Contenido del diálogo después de crear una cuenta: su contraseña temporal,
 * una sola vez. `discard` borra la contraseña de la memoria de la mutación
 * (al cerrar de cualquier forma); `onDone` corre con «Listo».
 */
export function CreatedAccountContent({
  title,
  created,
  discard,
  onDone,
}: {
  title: string;
  created: CreatedAccount;
  discard: () => void;
  onDone: () => void;
}) {
  return (
    <DialogContent
      title={title}
      onCloseAutoFocus={discard}
      footer={
        <Button
          onClick={() => {
            discard();
            onDone();
          }}
        >
          Listo
        </Button>
      }
    >
      <TemporaryPasswordPanel
        name={created.name}
        password={created.password}
        emailed={created.emailed}
      />
    </DialogContent>
  );
}
