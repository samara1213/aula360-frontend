import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { PerformanceLevels } from '@/api/types';
import { Field } from '@/components/form/field';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { formatScore } from '@/lib/format';
import { usePerformanceLevels, useReplacePerformanceLevels } from './academic-api';
import {
  formatLevelScore,
  MAX_LEVELS,
  validateLevels,
  type LevelErrors,
  type LevelRow,
} from './levels-rules';

const toRows = (data: PerformanceLevels): LevelRow[] =>
  data.levels.map((l) => ({
    name: l.name,
    minScore: formatLevelScore(l.minScore),
    maxScore: formatLevelScore(l.maxScore),
  }));

/** /academic/performance-levels */
export function PerformanceLevelsPage() {
  const { data, isPending, error, refetch } = usePerformanceLevels();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Niveles de desempeño"
        description="La escala nacional (Decreto 1290) con los rangos de nota de la institución. Se imprimen en los boletines."
      />
      {isPending ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : error ? (
        <Alert variant="error">
          No pudimos cargar los niveles.{' '}
          <button
            type="button"
            className="cursor-pointer font-bold text-primary underline"
            onClick={() => void refetch()}
          >
            Reintentar
          </button>
        </Alert>
      ) : (
        // Se monta de nuevo cuando llegan otros niveles (p. ej. tras guardar).
        <LevelsEditor key={JSON.stringify(data.levels)} data={data} />
      )}
    </div>
  );
}

function LevelsEditor({ data }: { data: PerformanceLevels }) {
  // Reemplazar los niveles exige el permiso en toda la institución.
  const canEdit = usePermissions('academic.performance-levels').institutionWide.update;
  const replace = useReplacePerformanceLevels();
  const [rows, setRows] = useState<LevelRow[]>(() => toRows(data));
  const [errors, setErrors] = useState<LevelErrors | null>(null);
  const { scale } = data;
  const scaleText = `de ${formatScore(scale.min)} a ${formatScore(scale.max)}; se aprueba con ${formatScore(scale.passingScore)}`;

  if (!canEdit) {
    return (
      <Section title="Niveles vigentes" description={`Escala ${scaleText}.`}>
        {data.levels.length === 0 ? (
          <p className="text-muted-foreground">La institución todavía no tiene niveles.</p>
        ) : (
          <table className="w-full text-left">
            <caption className="sr-only">Niveles de desempeño</caption>
            <thead>
              <tr className="border-b border-border text-sm text-muted-foreground">
                <th scope="col" className="py-2 font-bold">
                  Nivel
                </th>
                <th scope="col" className="py-2 font-bold">
                  Desde
                </th>
                <th scope="col" className="py-2 font-bold">
                  Hasta
                </th>
              </tr>
            </thead>
            <tbody>
              {data.levels.map((level) => (
                <tr key={level.id} className="border-b border-border last:border-0">
                  <th scope="row" className="py-3 font-bold">
                    {level.name}
                  </th>
                  <td className="py-3 tabular-nums">{formatLevelScore(level.minScore)}</td>
                  <td className="py-3 tabular-nums">{formatLevelScore(level.maxScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    );
  }

  const change = (index: number, field: keyof LevelRow, value: string) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const save = () => {
    const result = validateLevels(rows, scale);
    if ('errors' in result) {
      setErrors(result.errors);
      return;
    }
    setErrors(null);
    replace.mutate(result.levels, {
      onSuccess: () => toast.success('Niveles guardados.'),
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <Section
      title="Niveles vigentes"
      description={`Escala ${scaleText}. Cada nivel empieza 0,01 después del anterior.`}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex flex-col gap-5"
      >
        {errors?.general && <Alert variant="error">{errors.general}</Alert>}
        {replace.isError && <Alert variant="error">{errorMessage(replace.error)}</Alert>}
        <ol className="flex flex-col gap-4" aria-label="Niveles">
          {rows.map((row, index) => {
            const rowErrors = errors?.rows[index] ?? {};
            const label = row.name.trim() || `Nivel ${String(index + 1)}`;
            return (
              <li
                // El orden de las filas solo cambia al quitar una: la posición basta.
                key={index}
                className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-start"
              >
                <Field label="Nombre" error={rowErrors.name} className="col-span-2 sm:col-span-1">
                  {(control) => (
                    <Input
                      autoComplete="off"
                      maxLength={50}
                      value={row.name}
                      onChange={(e) => {
                        change(index, 'name', e.target.value);
                      }}
                      {...control}
                    />
                  )}
                </Field>
                <Field label="Desde" error={rowErrors.minScore}>
                  {(control) => (
                    <Input
                      inputMode="decimal"
                      autoComplete="off"
                      value={row.minScore}
                      onChange={(e) => {
                        change(index, 'minScore', e.target.value);
                      }}
                      {...control}
                    />
                  )}
                </Field>
                <Field label="Hasta" error={rowErrors.maxScore}>
                  {(control) => (
                    <Input
                      inputMode="decimal"
                      autoComplete="off"
                      value={row.maxScore}
                      onChange={(e) => {
                        change(index, 'maxScore', e.target.value);
                      }}
                      {...control}
                    />
                  )}
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  className="col-span-2 sm:col-span-1 sm:mt-7"
                  aria-label={`Quitar ${label}`}
                  disabled={rows.length === 1}
                  onClick={() => {
                    setRows((current) => current.filter((_, i) => i !== index));
                    setErrors(null);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  <span className="sm:sr-only">Quitar</span>
                </Button>
              </li>
            );
          })}
        </ol>
        {rows.length === 0 && (
          <p className="text-muted-foreground">
            La institución todavía no tiene niveles. Agrega el primero.
          </p>
        )}
        <div className="flex flex-wrap justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={rows.length >= MAX_LEVELS}
            onClick={() => {
              setRows((current) => [...current, { name: '', minScore: '', maxScore: '' }]);
            }}
          >
            <Plus aria-hidden="true" />
            Agregar nivel
          </Button>
          <Button type="submit" disabled={replace.isPending}>
            {replace.isPending ? 'Guardando…' : 'Guardar niveles'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Al guardar cambios, los boletines ya generados de los años activos quedan marcados como
          desactualizados.
        </p>
      </form>
    </Section>
  );
}
