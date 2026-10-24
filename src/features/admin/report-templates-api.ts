import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import { isUuid } from '@/lib/ids';

// Plantillas del boletín de una institución (solo SUPER_ADMIN). La
// institución va en la ruta y en la clave.

/** Lo mismo que valida el backend (TEMPLATE_MAX_BYTES). */
export const TEMPLATE_MAX_BYTES = 256 * 1024;

/** Por qué no sirve el archivo, o null si sirve. El backend la valida entera. */
export function templateProblem(file: File): string | null {
  if (!/\.html?$/i.test(file.name)) return 'Usa un archivo .html.';
  if (file.size === 0) return 'El archivo está vacío.';
  if (file.size > TEMPLATE_MAX_BYTES) return 'La plantilla pesa más de 256 KB.';
  return null;
}

const templatesKey = (institutionId: string) => ['report-templates', institutionId] as const;

export function useReportTemplates(institutionId: string) {
  return useQuery({
    queryKey: templatesKey(institutionId),
    queryFn: () =>
      unwrap(
        api.GET('/api/institutions/{institutionId}/report-card-templates', {
          params: { path: { institutionId } },
        }),
      ),
    enabled: isUuid(institutionId),
  });
}

function useInvalidateTemplates(institutionId: string) {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: templatesKey(institutionId) });
}

export type UploadTemplate = { file: File; name: string; description: string | null };

export function useUploadTemplate(institutionId: string) {
  const invalidate = useInvalidateTemplates(institutionId);
  return useMutation({
    mutationFn: ({ file, name, description }: UploadTemplate) =>
      unwrap(
        api.POST('/api/institutions/{institutionId}/report-card-templates', {
          params: { path: { institutionId } },
          body: { file: '', name },
          bodySerializer: () => {
            const data = new FormData();
            data.append('name', name);
            if (description) data.append('description', description);
            // Con su nombre: el backend exige la extensión .html.
            data.append('file', file, file.name);
            return data;
          },
        }),
      ),
    onSuccess: invalidate,
  });
}

/** Activa (y desactiva la que estuviera activa) o vuelve a la del sistema. */
export function useSetTemplateActive(institutionId: string) {
  const invalidate = useInvalidateTemplates(institutionId);
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => {
      if (!isUuid(id)) throw new Error('Plantilla inválida');
      const params = { params: { path: { institutionId, id } } };
      return unwrap(
        active
          ? api.PATCH(
              '/api/institutions/{institutionId}/report-card-templates/{id}/activate',
              params,
            )
          : api.PATCH(
              '/api/institutions/{institutionId}/report-card-templates/{id}/deactivate',
              params,
            ),
      );
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTemplate(institutionId: string) {
  const invalidate = useInvalidateTemplates(institutionId);
  return useMutation({
    mutationFn: (id: string) => {
      if (!isUuid(id)) throw new Error('Plantilla inválida');
      return unwrap(
        api.DELETE('/api/institutions/{institutionId}/report-card-templates/{id}', {
          params: { path: { institutionId, id } },
        }),
      );
    },
    onSuccess: invalidate,
  });
}

/**
 * Vista previa en PDF con datos de ejemplo; id null = la plantilla del
 * sistema. Sin caché: se pide en cada clic.
 */
export async function templatePreview(institutionId: string, id: string | null): Promise<Blob> {
  if (!isUuid(institutionId) || (id !== null && !isUuid(id))) {
    throw new Error('Plantilla inválida');
  }
  return id === null
    ? unwrap(
        api.GET('/api/institutions/{institutionId}/report-card-templates/system/preview', {
          params: { path: { institutionId } },
          parseAs: 'blob',
        }),
      )
    : unwrap(
        api.GET('/api/institutions/{institutionId}/report-card-templates/{id}/preview', {
          params: { path: { institutionId, id } },
          parseAs: 'blob',
        }),
      );
}
