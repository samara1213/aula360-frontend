import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError, errorMessage } from '@/api/errors';
import { openPdfInNewTab } from '@/lib/open-file';
import { reportCardPdf } from './reports-api';

/** Pide el PDF al hacer clic y lo abre en otra pestaña. */
export function useDownload() {
  const [pending, setPending] = useState<string | null>(null);
  const download = (id: string) => {
    setPending(id);
    openPdfInNewTab(() => reportCardPdf(id), 'boletin.pdf')
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
  return { download, pending };
}
