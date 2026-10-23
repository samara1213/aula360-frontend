/** Cuánto vive la URL en memoria del archivo abierto (la pestaña ya lo cargó). */
const REVOKE_AFTER_MS = 60_000;

/**
 * Abre en una pestaña nueva un PDF que se pide al servidor, sin que quede en
 * la caché de disco ni con una URL externa en el historial: se descarga en
 * memoria y se muestra con una URL `blob:` que se libera después (M1 y B2 de
 * la 3f-1). La pestaña se abre antes de esperar la respuesta: abierta
 * después, el navegador la bloquearía por no venir directamente del clic.
 * Si la bloquea igual, el PDF se descarga como archivo, sin salir de la app.
 *
 * El tipo se fija a PDF: un contenido HTML abierto como blob correría con el
 * origen de la app.
 */
export async function openPdfInNewTab(getPdf: () => Promise<Blob>, filename: string) {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  let pdf: Blob;
  try {
    // Los bytes, no el Blob recibido: así el tipo es siempre el fijado aquí.
    pdf = new Blob([await (await getPdf()).arrayBuffer()], { type: 'application/pdf' });
  } catch (error) {
    tab?.close();
    throw error;
  }
  const url = URL.createObjectURL(pdf);
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_AFTER_MS);
  if (tab && !tab.closed) {
    tab.location.href = url;
    return;
  }
  if (tab?.closed) return; // La cerró mientras esperaba: no se abre nada.
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
}
