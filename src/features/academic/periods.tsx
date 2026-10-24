import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { z } from '@/lib/zod';
import { errorMessage } from '@/api/errors';
import type { AcademicYear, Period } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataList, RowActions, type Column } from '@/components/data/data-list';
import { ListToolbar } from '@/components/data/list-toolbar';
import { Field } from '@/components/form/field';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { formatDay, isDay } from '@/lib/format';
import {
  useCreatePeriod,
  useDeletePeriod,
  usePeriods,
  useUpdatePeriod,
  useYearChoices,
} from './academic-api';

type Open = { kind: 'create' } | { kind: 'edit' | 'delete'; period: Period } | null;

const COLUMNS: Column<Period>[] = [
  { key: 'name', header: 'Nombre', cell: (p) => p.name },
  { key: 'start', header: 'Inicio', cell: (p) => formatDay(p.startDate) },
  { key: 'end', header: 'Fin', cell: (p) => formatDay(p.endDate) },
];

/** /academic/periods: los periodos del año elegido (`?year=<id>`). */
export function PeriodsPage() {
  const id = useId();
  const [params, setParams] = useSearchParams();
  const yearsAccess = usePermissions('academic.years');
  const canListYears = yearsAccess.view;
  const { data, isPending, error, refetch } = useYearChoices({ enabled: canListYears });
  const years = data?.data ?? [];
  // El de la URL si existe; si no, el activo más reciente; si no, el más reciente.
  const year =
    years.find((y) => y.id === params.get('year')) ?? years.find((y) => y.isActive) ?? years[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Periodos"
        description="Los cortes de evaluación de cada año lectivo. Sus fechas no se cruzan."
      />
      {!yearsAccess.isLoading && !canListYears ? (
        <Alert variant="info">
          Para ver los periodos necesitas también el permiso de ver Años lectivos. Pídeselo a quien
          administra los roles de la institución.
        </Alert>
      ) : isPending ? (
        <Skeleton className="h-11 w-56" />
      ) : error ? (
        <Alert variant="error">
          No pudimos cargar los años lectivos.{' '}
          <button
            type="button"
            className="cursor-pointer font-bold text-primary underline"
            onClick={() => void refetch()}
          >
            Reintentar
          </button>
        </Alert>
      ) : !year ? (
        <EmptyYears />
      ) : (
        <>
          <ListToolbar>
            <div className="flex flex-col gap-2 sm:w-56">
              <Label htmlFor={id}>Año lectivo</Label>
              <NativeSelect
                id={id}
                value={year.id}
                onChange={(e) => {
                  setParams({ year: e.target.value }, { replace: true });
                }}
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.year}
                    {y.isActive ? '' : ' (inactivo)'}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </ListToolbar>
          <PeriodsPanel key={year.id} year={year} />
        </>
      )}
    </div>
  );
}

function EmptyYears() {
  // Crear años exige el permiso en toda la institución (I1 de la 3d-1).
  const canCreate = usePermissions('academic.years').institutionWide.create;
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <p className="font-bold">Todavía no hay años lectivos.</p>
      <p className="mt-1 text-muted-foreground">
        Los periodos pertenecen a un año.{' '}
        {canCreate ? (
          <Link to="/academic/years" className="font-bold text-primary underline">
            Crea el año lectivo primero
          </Link>
        ) : (
          'Cuando la institución cree su año lectivo, sus periodos aparecerán aquí.'
        )}
      </p>
    </div>
  );
}

/** Periodos de un año: en la ficha del año y en /academic/periods. */
export function PeriodsPanel({ year }: { year: AcademicYear }) {
  const { data, isPending, error, refetch } = usePeriods(year.id);
  // Las escrituras de periodos exigen el permiso en toda la institución.
  const can = usePermissions('academic.periods').institutionWide;
  const remove = useDeletePeriod(year.id);
  const [open, setOpen] = useState<Open>(null);
  const close = () => {
    setOpen(null);
  };

  return (
    <Section
      title={`Periodos de ${String(year.year)}`}
      description="Deben empezar dentro del año lectivo y pueden terminar hasta el 31 de diciembre del año siguiente (calendario B)."
      actions={
        can.create && (
          <Button
            onClick={() => {
              setOpen({ kind: 'create' });
            }}
          >
            <Plus aria-hidden="true" />
            Nuevo periodo
          </Button>
        )
      }
    >
      <DataList
        label={`Periodos de ${String(year.year)}`}
        columns={COLUMNS}
        rows={data}
        getKey={(p) => p.id}
        isPending={isPending}
        error={error}
        onRetry={() => void refetch()}
        empty={
          <>
            <p className="font-bold">Este año todavía no tiene periodos.</p>
            {can.create && (
              <p className="mt-1 text-muted-foreground">Crea el primero con «Nuevo periodo».</p>
            )}
          </>
        }
        actions={
          can.update || can.delete
            ? (period) => (
                <RowActions label={`Acciones de ${period.name}`}>
                  {can.update && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setOpen({ kind: 'edit', period });
                      }}
                    >
                      <Pencil aria-hidden="true" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {can.delete && (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        setOpen({ kind: 'delete', period });
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      Eliminar
                    </DropdownMenuItem>
                  )}
                </RowActions>
              )
            : undefined
        }
      />

      <Dialog
        open={open?.kind === 'create' || open?.kind === 'edit'}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        {(open?.kind === 'create' || open?.kind === 'edit') && (
          <PeriodFormDialog
            key={open.kind === 'edit' ? open.period.id : 'new'}
            year={year}
            period={open.kind === 'edit' ? open.period : undefined}
            onDone={close}
          />
        )}
      </Dialog>

      {open?.kind === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          title={`¿Eliminar «${open.period.name}»?`}
          description="Solo se puede eliminar un periodo sin evaluaciones ni boletines. Esta acción no se puede deshacer."
          confirmLabel="Eliminar periodo"
          pendingLabel="Eliminando…"
          destructive
          pending={remove.isPending}
          onConfirm={() => {
            const { period } = open;
            remove.mutate(period.id, {
              onSuccess: () => {
                toast.success(`«${period.name}» se eliminó.`);
                close();
              },
              onError: (err) => toast.error(errorMessage(err)),
            });
          }}
        />
      )}
    </Section>
  );
}

/** Las mismas reglas que el backend; los cruces con otros periodos los decide él. */
function periodSchema(year: number) {
  const lastDay = `${String(year + 1)}-12-31`;
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, 'Escribe el nombre del periodo.')
        .max(100, 'Máximo 100 caracteres.'),
      startDate: z.string().refine(isDay, 'Elige una fecha de inicio válida.'),
      endDate: z.string().refine(isDay, 'Elige una fecha de fin válida.'),
    })
    .superRefine(({ startDate, endDate }, ctx) => {
      // Fechas 'YYYY-MM-DD': el orden de texto es el orden cronológico.
      if (isDay(startDate) && !startDate.startsWith(`${String(year)}-`)) {
        ctx.addIssue({
          code: 'custom',
          path: ['startDate'],
          message: `Debe empezar dentro de ${String(year)}.`,
        });
      }
      if (isDay(endDate) && endDate > lastDay) {
        ctx.addIssue({
          code: 'custom',
          path: ['endDate'],
          message: `Debe terminar a más tardar el ${formatDay(lastDay)}.`,
        });
      }
      if (isDay(startDate) && isDay(endDate) && endDate < startDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['endDate'],
          message: 'No puede ser anterior a la fecha de inicio.',
        });
      }
    });
}
type FormValues = { name: string; startDate: string; endDate: string };

const FORM_ID = 'period-form';

/** Crear (sin `period`) o editar un periodo del año. Solo envía lo que cambió. */
function PeriodFormDialog({
  year,
  period,
  onDone,
}: {
  year: AcademicYear;
  period?: Period;
  onDone: () => void;
}) {
  const create = useCreatePeriod(year.id);
  const update = useUpdatePeriod(year.id);
  const mutation = period ? update : create;
  const form = useForm<FormValues>({
    resolver: zodResolver(periodSchema(year.year)),
    defaultValues: {
      name: period?.name ?? '',
      startDate: period?.startDate ?? '',
      endDate: period?.endDate ?? '',
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    const options = {
      onSuccess: () => {
        toast.success(period ? 'Periodo guardado.' : `«${values.name}» creado.`);
        onDone();
      },
    };
    if (period) {
      const body = Object.fromEntries(
        Object.entries(values).filter(([field, value]) => period[field as keyof Period] !== value),
      );
      if (Object.keys(body).length === 0) {
        onDone();
        return;
      }
      update.mutate({ id: period.id, body }, options);
    } else {
      create.mutate(values, options);
    }
  });

  const minDay = `${String(year.year)}-01-01`;
  const maxDay = `${String(year.year + 1)}-12-31`;
  return (
    <DialogContent
      title={period ? 'Editar periodo' : 'Nuevo periodo'}
      description={
        period
          ? 'Si ya tiene boletines, sus fechas no se pueden cambiar.'
          : `Del año lectivo ${String(year.year)}.`
      }
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={FORM_ID} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : period ? 'Guardar cambios' : 'Crear periodo'}
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
        {mutation.isError && <Alert variant="error">{errorMessage(mutation.error)}</Alert>}
        <Field label="Nombre" error={errors.name?.message}>
          {(control) => (
            <Input
              autoComplete="off"
              placeholder="Primer periodo"
              {...control}
              {...form.register('name')}
            />
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Inicio" error={errors.startDate?.message}>
            {(control) => (
              <Input
                type="date"
                min={minDay}
                max={`${String(year.year)}-12-31`}
                {...control}
                {...form.register('startDate')}
              />
            )}
          </Field>
          <Field label="Fin" error={errors.endDate?.message}>
            {(control) => (
              <Input
                type="date"
                min={minDay}
                max={maxDay}
                {...control}
                {...form.register('endDate')}
              />
            )}
          </Field>
        </div>
      </form>
    </DialogContent>
  );
}
