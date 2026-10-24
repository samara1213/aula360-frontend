import { useOpenPdf } from '@/lib/use-open-pdf';
import { reportCardPdf } from './reports-api';

/** Pide el PDF del boletín al hacer clic y lo abre en otra pestaña. */
export function useDownload() {
  const { open, pending } = useOpenPdf(reportCardPdf, 'boletin.pdf');
  return { download: open, pending };
}
