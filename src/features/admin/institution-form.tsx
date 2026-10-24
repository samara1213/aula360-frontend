import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from '@/lib/zod';
import { errorMessage } from '@/api/errors';
import type { CreateInstitutionBody, Institution, UpdateInstitutionBody } from '@/api/types';
import { Field } from '@/components/form/field';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';

/** Valor de la escala (DECIMAL(4,2)): de 0 a 99,99, con coma o punto. */
const scaleValue = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Escribe ${label}.`)
    .transform((value) => value.replace(',', '.'))
    .pipe(
      z
        .string()
        .regex(/^\d{1,2}(\.\d{1,2})?$/, 'Usa un número de 0 a 99,99 con máximo dos decimales.'),
    )
    .transform(Number);

// Las mismas reglas que CreateInstitutionDto y assertValidScale del backend.
const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Escribe el nombre de la institución.')
      .max(255, 'Máximo 255 caracteres.'),
    nit: z
      .string()
      .trim()
      .min(1, 'Escribe el NIT.')
      .max(50, 'Máximo 50 caracteres.')
      .regex(/^[0-9A-Za-z.-]+$/, 'Solo números, letras, puntos y guiones (sin espacios).'),
    gradingScaleMin: scaleValue('la nota mínima'),
    gradingScaleMax: scaleValue('la nota máxima'),
    passingScore: scaleValue('la nota para aprobar'),
  })
  .refine((v) => v.gradingScaleMin < v.gradingScaleMax, {
    path: ['gradingScaleMax'],
    message: 'La nota máxima debe ser mayor que la mínima.',
  })
  .refine((v) => v.passingScore >= v.gradingScaleMin && v.passingScore <= v.gradingScaleMax, {
    path: ['passingScore'],
    message: 'La nota para aprobar debe estar entre la mínima y la máxima.',
  });

type FormInput = z.input<typeof schema>;

const toText = (value: number) => String(value).replace('.', ',');

type InstitutionFormProps = {
  /** Sin institución: formulario de creación (escala 1 a 5, aprueba con 3). */
  institution?: Institution;
  formId: string;
  error: unknown;
  /**
   * `changed`: solo los campos que difieren de `institution` (al editar se
   * envían solo esos: así no se pisa lo que otro cambió a la vez, B6 de 3b-1).
   */
  onSubmit: (body: Required<CreateInstitutionBody>, changed: UpdateInstitutionBody) => void;
};

const FIELDS = ['name', 'nit', 'gradingScaleMin', 'gradingScaleMax', 'passingScore'] as const;

function changedFields(
  body: Required<CreateInstitutionBody>,
  institution: Institution | undefined,
): UpdateInstitutionBody {
  if (!institution) return body;
  return Object.fromEntries(
    FIELDS.filter((k) => body[k] !== institution[k]).map((k) => [k, body[k]]),
  );
}

/** Campos de una institución; los botones los pone quien lo usa (atributo form). */
export function InstitutionForm({ institution, formId, error, onSubmit }: InstitutionFormProps) {
  const form = useForm<FormInput, unknown, Required<CreateInstitutionBody>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: institution?.name ?? '',
      nit: institution?.nit ?? '',
      gradingScaleMin: toText(institution?.gradingScaleMin ?? 1),
      gradingScaleMax: toText(institution?.gradingScaleMax ?? 5),
      passingScore: toText(institution?.passingScore ?? 3),
    },
  });
  const { errors } = form.formState;

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(e) =>
        void form.handleSubmit((body) => {
          onSubmit(body, changedFields(body, institution));
        })(e)
      }
      className="flex flex-col gap-5"
    >
      {error !== null && error !== undefined && (
        <Alert variant="error">{errorMessage(error)}</Alert>
      )}
      <Field label="Nombre" error={errors.name?.message}>
        {(control) => <Input autoComplete="organization" {...control} {...form.register('name')} />}
      </Field>
      <Field
        label="NIT"
        error={errors.nit?.message}
        hint="Con el dígito de verificación, por ejemplo 900123456-7."
      >
        {(control) => (
          <Input autoComplete="off" spellCheck={false} {...control} {...form.register('nit')} />
        )}
      </Field>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-bold">Escala de notas</legend>
        <p className="-mt-2 text-sm text-muted-foreground">
          No se puede cambiar cuando la institución ya tiene notas registradas.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nota mínima" error={errors.gradingScaleMin?.message}>
            {(control) => (
              <Input inputMode="decimal" {...control} {...form.register('gradingScaleMin')} />
            )}
          </Field>
          <Field label="Nota máxima" error={errors.gradingScaleMax?.message}>
            {(control) => (
              <Input inputMode="decimal" {...control} {...form.register('gradingScaleMax')} />
            )}
          </Field>
          <Field label="Aprueba con" error={errors.passingScore?.message}>
            {(control) => (
              <Input inputMode="decimal" {...control} {...form.register('passingScore')} />
            )}
          </Field>
        </div>
      </fieldset>
    </form>
  );
}
