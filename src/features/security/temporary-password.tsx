import { Copy, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

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
