import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError, errorMessage } from '@/api/errors';
import { openPdfInNewTab } from './open-file';

/**
 * Pide un PDF al hacer clic y lo abre en otra pestaña (boletines, vistas
 * previas de plantillas). `pending` es la clave del que se está abriendo.
 */
export function useOpenPdf<K extends string>(getPdf: (key: K) => Promise<Blob>, filename: string) {
  const [pending, setPending] = useState<K | null>(null);
  const open = (key: K) => {
    setPending(key);
    openPdfInNewTab(() => getPdf(key), filename)
      .catch((err: unknown) => {
        // Un error que no viene de la API no es de conexión (I2 de la 3f-1).
        toast.error(
          err instanceof ApiError
            ? errorMessage(err)
            : 'No pudimos abrir el PDF. Inténtalo de nuevo.',
        );
      })
      .finally(() => {
        setPending(null);
      });
  };
  return { open, pending };
}
