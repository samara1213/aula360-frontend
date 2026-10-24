import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, CircleOff, Eye, FileUp, Trash2 } from 'lucide-react';
import { useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError, errorMessage } from '@/api/errors';
import type { ReportTemplate } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { RowActions } from '@/components/data/data-list';
import { Field } from '@/components/form/field';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import { useOpenPdf } from '@/lib/use-open-pdf';
import {
  templatePreview,
  templateProblem,
  useDeleteTemplate,
  useReportTemplates,
  useSetTemplateActive,
  useUploadTemplate,
} from './report-templates-api';

/** Clave de la vista previa de la plantilla del sistema. */
const SYSTEM = 'system';

/**
 * Pestaña «Boletín» del detalle de la institución (SUPER_ADMIN): la plantilla
 * del sistema y las subidas; una sola en uso. Las plantillas no se editan:
 * para cambiar el diseño se sube otra.
 */
export function ReportTemplates({ institutionId }: { institutionId: string }) {
  const { data, isPending, error, refetch } = useReportTemplates(institutionId);
  const setActive = useSetTemplateActive(institutionId);
  const preview = useOpenPdf(
    (key: string) => templatePreview(institutionId, key === SYSTEM ? null : key),
    'vista-previa.pdf',
  );
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<ReportTemplate | null>(null);
  const active = data?.find((t) => t.isActive);

  const toggle = (template: ReportTemplate) => {
    const next = !template.isActive;
    setActive.mutate(
      { id: template.id, active: next },
      {
        onSuccess: () =>
          toast.success(
            next
              ? `Los boletines nuevos usarán «${template.name}».`
              : 'Los boletines nuevos usarán la plantilla del sistema.',
          ),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Plantillas del boletín"
        description="La plantilla en uso da el diseño a los boletines que se generen desde ahora. Los ya generados no cambian."
        actions={
          <Button
            onClick={() => {
              setUploading(true);
            }}
          >
            <FileUp aria-hidden="true" />
            Subir plantilla
          </Button>
        }
      >
        {isPending ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : error ? (
          <Alert variant="error">
            No pudimos cargar las plantillas.{' '}
            <button
              type="button"
              className="cursor-pointer font-bold text-primary underline"
              onClick={() => void refetch()}
            >
              Reintentar
            </button>
          </Alert>
        ) : (
          <ul aria-label="Plantillas" className="flex flex-col divide-y divide-border">
            <TemplateRow
              name="Plantilla del sistema"
              detail="El diseño de Aula360. Se usa mientras no haya otra en uso."
              inUse={!active}
              previewing={preview.pending === SYSTEM}
              onPreview={() => {
                preview.open(SYSTEM);
              }}
            />
            {data.map((t) => (
              <TemplateRow
                key={t.id}
                name={t.name}
                description={t.description}
                detail={`Subida el ${formatDate(t.createdAt)}`}
                inUse={t.isActive}
                previewing={preview.pending === t.id}
                onPreview={() => {
                  preview.open(t.id);
                }}
                actions={
                  <RowActions label={`Acciones de la plantilla ${t.name}`}>
                    <DropdownMenuItem
                      disabled={setActive.isPending}
                      onSelect={() => {
                        toggle(t);
                      }}
                    >
                      {t.isActive ? (
                        <CircleOff aria-hidden="true" />
                      ) : (
                        <CircleCheck aria-hidden="true" />
                      )}
                      {t.isActive ? 'Dejar de usar' : 'Usar en los boletines'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        setDeleting(t);
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      Borrar
                    </DropdownMenuItem>
                  </RowActions>
                }
              />
            ))}
          </ul>
        )}
      </Section>

      <TemplateGuide />

      <Dialog open={uploading} onOpenChange={setUploading}>
        {uploading && (
          <UploadTemplateDialog
            institutionId={institutionId}
            onDone={() => {
              setUploading(false);
            }}
          />
        )}
      </Dialog>
      <DeleteTemplateDialog
        institutionId={institutionId}
        template={deleting}
        onClose={() => {
          setDeleting(null);
        }}
      />
    </div>
  );
}

function TemplateRow({
  name,
  description,
  detail,
  inUse,
  previewing,
  onPreview,
  actions,
}: {
  name: string;
  description?: string | null;
  detail: string;
  inUse: boolean;
  previewing: boolean;
  onPreview: () => void;
  actions?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 basis-64">
        <p className="flex flex-wrap items-center gap-2 font-bold break-words">
          {name}
          {inUse && <Badge variant="active">En uso</Badge>}
        </p>
        {description && <p className="mt-1 break-words">{description}</p>}
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" disabled={previewing} onClick={onPreview}>
          <Eye aria-hidden="true" />
          {previewing ? 'Abriendo…' : 'Vista previa'} <span className="sr-only">de {name}</span>
        </Button>
        {actions}
      </div>
    </li>
  );
}

// Las mismas reglas que CreateReportTemplateDto. La descripción vacía no se envía.
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre de la plantilla.')
    .max(100, 'Máximo 100 caracteres.'),
  description: z
    .string()
    .trim()
    .max(500, 'Máximo 500 caracteres.')
    .transform((value) => value || null),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const FORM_ID = 'template-form';

function UploadTemplateDialog({
  institutionId,
  onDone,
}: {
  institutionId: string;
  onDone: () => void;
}) {
  const upload = useUploadTemplate(institutionId);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((body) => {
    if (!file) return;
    upload.mutate(
      { file, ...body },
      {
        onSuccess: () => {
          toast.success(`«${body.name}» subida. Revísala con la vista previa antes de usarla.`);
          onDone();
        },
      },
    );
  });
  // El archivo se valida junto con los campos: se ven todos los errores a la vez.
  const onSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    if (!file) setFileError((current) => current ?? 'Elige el archivo .html de la plantilla.');
    return submit(e);
  };

  return (
    <DialogContent
      title="Subir plantilla"
      description="Queda guardada sin usarse: revísala con la vista previa y después elige usarla en los boletines."
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={FORM_ID} disabled={upload.isPending}>
            {upload.isPending ? 'Subiendo…' : 'Subir plantilla'}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="flex flex-col gap-5"
      >
        {upload.isError && <Alert variant="error">{errorMessage(upload.error)}</Alert>}
        <Field
          label="Archivo"
          error={fileError ?? undefined}
          hint="HTML en UTF-8 de máximo 256 KB."
        >
          {(control) => (
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={input}
                // La etiqueta abre el selector; el botón lleva su propio nombre.
                id={control.id}
                type="file"
                accept=".html,.htm,text/html"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  e.target.value = '';
                  if (!chosen) return;
                  const problem = templateProblem(chosen);
                  setFileError(problem);
                  setFile(problem ? null : chosen);
                }}
              />
              <Button
                variant="outline"
                aria-invalid={control['aria-invalid']}
                aria-describedby={control['aria-describedby']}
                onClick={() => input.current?.click()}
              >
                <FileUp aria-hidden="true" />
                {file ? 'Cambiar archivo' : 'Elegir archivo'}
              </Button>
              {file && <span className="min-w-0 break-all">{file.name}</span>}
            </div>
          )}
        </Field>
        <Field label="Nombre" error={errors.name?.message}>
          {(control) => <Input autoComplete="off" {...control} {...form.register('name')} />}
        </Field>
        <Field label="Descripción (opcional)" error={errors.description?.message}>
          {(control) => <Textarea {...control} {...form.register('description')} />}
        </Field>
      </form>
    </DialogContent>
  );
}

function DeleteTemplateDialog({
  institutionId,
  template,
  onClose,
}: {
  institutionId: string;
  template: ReportTemplate | null;
  onClose: () => void;
}) {
  const remove = useDeleteTemplate(institutionId);
  return (
    <ConfirmDialog
      open={template !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`¿Borrar «${template?.name ?? ''}»?`}
      description={
        template?.isActive
          ? 'Está en uso: los boletines nuevos pasarán a la plantilla del sistema. No se puede deshacer.'
          : 'Se borra el archivo. No se puede deshacer.'
      }
      confirmLabel="Borrar plantilla"
      pendingLabel="Borrando…"
      destructive
      pending={remove.isPending}
      onConfirm={() => {
        if (!template) return;
        remove.mutate(template.id, {
          onSuccess: () => {
            toast.success(`«${template.name}» borrada.`);
            onClose();
          },
          onError: (err) => {
            toast.error(
              err instanceof ApiError && err.status === 409
                ? 'Ya se usó en boletines y no se puede borrar. Puedes dejar de usarla.'
                : errorMessage(err),
            );
            onClose();
          },
        });
      }}
    />
  );
}

/** Contrato v1 (report-template.engine.ts del backend). */
const VARIABLES: [string, string][] = [
  [
    'institution.name, institution.nit, institution.logoDataUri',
    'Institución; el logo como data: URI (puede ser vacío)',
  ],
  ['campus.name', 'Sede del curso (puede no haber)'],
  ['academicYear.year', 'Año lectivo'],
  ['period.name, period.startDate, period.endDate', 'Periodo'],
  ['course.name, course.grade', 'Curso y grado'],
  [
    'student.firstName, student.lastName, student.documentType, student.documentNumber',
    'Estudiante',
  ],
  ['subjects', 'Lista de materias: name, teacher, final, accumulated, pending, level, passed'],
  [
    'average, averageLevel, averagePartial',
    'Promedio del periodo, su nivel y si le faltan definitivas',
  ],
  ['scale.min, scale.max, scale.passingScore', 'Escala de la institución'],
  ['levels', 'Niveles de desempeño: name, minScore, maxScore'],
  ['generatedAt', 'Fecha de generación'],
];

const HELPERS: [string, string][] = [
  ['{{score average}}', 'Nota con dos decimales y coma («4,25»); «—» si no hay'],
  ['{{date generatedAt}}', 'Fecha como dd/mm/aaaa'],
  ['{{#if (eq a b)}}', 'Compara dos valores'],
  ['{{levelClass level}}', 'Clase CSS del nivel de desempeño'],
];

function TemplateGuide() {
  return (
    <Section
      title="Cómo escribir una plantilla"
      description="HTML con variables de Handlebars. La vista previa usa datos de ejemplo con el nombre, el logo, la escala y los niveles de esta institución."
    >
      <Alert variant="info">
        Los datos siempre salen escapados: no se permiten <code>{'{{{ }}}'}</code> ni{' '}
        <code>{'{{& }}'}</code>, parciales, helpers fuera de la lista ni direcciones externas (las
        imágenes van incrustadas como <code>data:</code>). El PDF se imprime sin JavaScript ni red,
        en tamaño Carta salvo que la plantilla defina su <code>@page</code>.
      </Alert>
      <details className="group rounded-2xl border border-border">
        <summary className="flex min-h-12 cursor-pointer list-none items-center rounded-2xl px-4 py-3 font-bold outline-none focus-visible:ring-4 focus-visible:ring-ring/25 [&::-webkit-details-marker]:hidden">
          Variables disponibles
        </summary>
        <dl className="flex flex-col divide-y divide-border px-4 pb-2">
          {VARIABLES.map(([name, meaning]) => (
            <div key={name} className="flex flex-col gap-1 py-2.5">
              <dt>
                <code className="break-words">{name}</code>
              </dt>
              <dd className="text-sm text-muted-foreground">{meaning}</dd>
            </div>
          ))}
        </dl>
      </details>
      <details className="group rounded-2xl border border-border">
        <summary className="flex min-h-12 cursor-pointer list-none items-center rounded-2xl px-4 py-3 font-bold outline-none focus-visible:ring-4 focus-visible:ring-ring/25 [&::-webkit-details-marker]:hidden">
          Helpers
        </summary>
        <dl className="flex flex-col divide-y divide-border px-4 pb-2">
          {HELPERS.map(([usage, meaning]) => (
            <div key={usage} className="flex flex-col gap-1 py-2.5">
              <dt>
                <code>{usage}</code>
              </dt>
              <dd className="text-sm text-muted-foreground">{meaning}</dd>
            </div>
          ))}
        </dl>
      </details>
    </Section>
  );
}
