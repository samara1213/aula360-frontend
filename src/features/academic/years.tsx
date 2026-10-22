import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import type { AcademicYear } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataList, Pagination, RowActions, type Column } from '@/components/data/data-list';
import { useListParams } from '@/components/data/list-params';
import { ListToolbar, StatusSelect } from '@/components/data/list-toolbar';
import { RowLink } from '@/components/data/row-link';
import { DetailPage } from '@/components/detail-page';
import { Field } from '@/components/form/field';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { isUuid } from '@/lib/ids';
import {
  useAcademicYear,
  useAcademicYears,
  useCreateAcademicYear,
  useDeleteAcademicYear,
  useForgetYear,
  useUpdateAcademicYear,
} from './academic-api';
import { PeriodsPanel } from './periods';

const MALE: readonly [string, string] = ['Activo', 'Inactivo'];
const yearPath = (id: string) => `/academic/years/${encodeURIComponent(id)}`;

/** Igual que MIN_YEAR y MAX_YEAR del backend. */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/** Diálogo abierto: crear, editar el número, cambiar el estado o eliminar. */
type Open = { kind: 'create' } | { kind: 'edit' | 'toggle' | 'delete'; year: AcademicYear } | null;

/** Las escrituras de años exigen el permiso en toda la institución. */
function useYearPermissions() {
  return usePermissions('academic.years').institutionWide;
}

/** /academic/years */
export function YearsPage() {
  const list = useListParams('all');
  const query = {
    page: list.page,
    limit: list.query.limit,
    ...(list.status === 'all' ? {} : { isActive: list.status === 'active' }),
  };
  const { data, isPending, isFetching, error, refetch } = useAcademicYears(query);
  const can = useYearPermissions();
  const [open, setOpen] = useState<Open>(null);

  const columns: Column<AcademicYear>[] = [
    {
      key: 'year',
      header: 'Año',
      cell: (y) => <RowLink to={yearPath(y.id)}>{y.year}</RowLink>,
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (y) => <StatusBadge active={y.isActive} labels={MALE} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Años lectivos"
        description="Cada año agrupa sus periodos, cursos y matrículas. En un año inactivo no se crean cursos ni matrículas."
        actions={
          can.create && (
            <Button
              onClick={() => {
                setOpen({ kind: 'create' });
              }}
            >
              <Plus aria-hidden="true" />
              Nuevo año lectivo
            </Button>
          )
        }
      />
      <ListToolbar>
        <StatusSelect
          value={list.status}
          labels={['Activos', 'Inactivos', 'Todos']}
          onChange={(status) => {
            list.update({ status });
          }}
        />
      </ListToolbar>
      <DataList
        label="Años lectivos"
        columns={columns}
        rows={data?.data}
        getKey={(y) => y.id}
        isPending={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        empty={
          list.status !== 'all' ? (
            <p>Ningún año lectivo con ese estado.</p>
          ) : (
            <>
              <p className="font-bold">Todavía no hay años lectivos.</p>
              {can.create && (
                <p className="mt-1 text-muted-foreground">
                  Crea el primero con «Nuevo año lectivo».
                </p>
              )}
            </>
          )
        }
        actions={
          can.update || can.delete
            ? (year) => (
                <RowActions label={`Acciones del año ${String(year.year)}`}>
                  <YearMenuItems year={year} can={can} onOpen={setOpen} />
                </RowActions>
              )
            : undefined
        }
      />
      <Pagination
        meta={data?.meta}
        noun="años"
        onPage={(page) => {
          list.update({ page });
        }}
      />
      <YearDialogs
        open={open}
        onClose={() => {
          setOpen(null);
        }}
      />
    </div>
  );
}

function YearMenuItems({
  year,
  can,
  onOpen,
}: {
  year: AcademicYear;
  can: { update: boolean; delete: boolean };
  onOpen: (open: Open) => void;
}) {
  return (
    <>
      {can.update && (
        <DropdownMenuItem
          onSelect={() => {
            onOpen({ kind: 'edit', year });
          }}
        >
          <Pencil aria-hidden="true" />
          Cambiar el año
        </DropdownMenuItem>
      )}
      {can.update && (
        <DropdownMenuItem
          onSelect={() => {
            onOpen({ kind: 'toggle', year });
          }}
        >
          {year.isActive ? <PowerOff aria-hidden="true" /> : <Power aria-hidden="true" />}
          {year.isActive ? 'Desactivar' : 'Activar'}
        </DropdownMenuItem>
      )}
      {can.delete && (
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            onOpen({ kind: 'delete', year });
          }}
        >
          <Trash2 aria-hidden="true" />
          Eliminar
        </DropdownMenuItem>
      )}
    </>
  );
}

/** /academic/years/:id: el año y sus periodos. */
export function YearDetail({ id }: { id: string }) {
  const query = useAcademicYear(id);
  return (
    <DetailPage
      back={{ to: '/academic/years', label: 'Años lectivos' }}
      validId={isUuid(id)}
      query={query}
      noun="el año lectivo"
    >
      {(year) => <YearContent year={year} />}
    </DetailPage>
  );
}

function YearContent({ year }: { year: AcademicYear }) {
  const can = useYearPermissions();
  const periods = usePermissions('academic.periods');
  const navigate = useNavigate();
  const [open, setOpen] = useState<Open>(null);
  return (
    <>
      <PageHeader
        title={`Año lectivo ${String(year.year)}`}
        description={<StatusBadge active={year.isActive} labels={MALE} />}
        actions={
          <>
            {can.update && (
              <Button
                variant="outline"
                onClick={() => {
                  setOpen({ kind: 'edit', year });
                }}
              >
                <Pencil aria-hidden="true" />
                Cambiar el año
              </Button>
            )}
            {can.update && (
              <Button
                variant="outline"
                onClick={() => {
                  setOpen({ kind: 'toggle', year });
                }}
              >
                {year.isActive ? <PowerOff aria-hidden="true" /> : <Power aria-hidden="true" />}
                {year.isActive ? 'Desactivar' : 'Activar'}
              </Button>
            )}
            {can.delete && (
              <Button
                variant="outline"
                onClick={() => {
                  setOpen({ kind: 'delete', year });
                }}
              >
                <Trash2 aria-hidden="true" />
                Eliminar
              </Button>
            )}
          </>
        }
      />
      {periods.view && <PeriodsPanel year={year} />}
      <YearDialogs
        open={open}
        onClose={() => {
          setOpen(null);
        }}
        onDeleted={() => navigate('/academic/years', { replace: true })}
      />
    </>
  );
}

function YearDialogs({
  open,
  onClose,
  onDeleted,
}: {
  open: Open;
  onClose: () => void;
  /** Desde la ficha: salir de ella (la ficha se quita de la caché después). */
  onDeleted?: () => void | Promise<void>;
}) {
  const update = useUpdateAcademicYear();
  const remove = useDeleteAcademicYear();
  const forget = useForgetYear();
  const onError = (err: unknown) => toast.error(errorMessage(err));
  return (
    <>
      <Dialog
        open={open?.kind === 'create' || open?.kind === 'edit'}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        {(open?.kind === 'create' || open?.kind === 'edit') && (
          <YearFormDialog
            key={open.kind === 'edit' ? open.year.id : 'new'}
            year={open.kind === 'edit' ? open.year : undefined}
            onDone={onClose}
          />
        )}
      </Dialog>

      {open?.kind === 'toggle' && (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) onClose();
          }}
          title={
            open.year.isActive
              ? `¿Desactivar el año ${String(open.year.year)}?`
              : `¿Activar el año ${String(open.year.year)}?`
          }
          description={
            open.year.isActive
              ? 'No se podrán crear cursos, matrículas ni carga académica en él. Sus datos se conservan y puedes activarlo cuando quieras.'
              : 'Se podrán crear cursos, matrículas y carga académica en él. Puede haber varios años activos a la vez.'
          }
          confirmLabel={open.year.isActive ? 'Desactivar año' : 'Activar año'}
          pendingLabel={open.year.isActive ? 'Desactivando…' : 'Activando…'}
          destructive={open.year.isActive}
          pending={update.isPending}
          onConfirm={() => {
            const { year } = open;
            update.mutate(
              { id: year.id, body: { isActive: !year.isActive } },
              {
                onSuccess: () => {
                  toast.success(
                    year.isActive
                      ? `El año ${String(year.year)} quedó inactivo.`
                      : `El año ${String(year.year)} quedó activo.`,
                  );
                  onClose();
                },
                onError,
              },
            );
          }}
        />
      )}

      {open?.kind === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) onClose();
          }}
          title={`¿Eliminar el año ${String(open.year.year)}?`}
          description="Solo se puede eliminar un año sin periodos, cursos ni matrículas. Esta acción no se puede deshacer."
          confirmLabel="Eliminar año"
          pendingLabel="Eliminando…"
          destructive
          pending={remove.isPending}
          onConfirm={() => {
            const { year } = open;
            remove.mutate(year.id, {
              onSuccess: () => {
                toast.success(`El año ${String(year.year)} se eliminó.`);
                onClose();
                void Promise.resolve(onDeleted?.()).then(() => {
                  forget(year.id);
                });
              },
              onError,
            });
          }}
        />
      )}
    </>
  );
}

const schema = z.object({
  year: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Escribe el año con cuatro cifras.')
    .transform(Number)
    .refine(
      (year) => year >= MIN_YEAR && year <= MAX_YEAR,
      `Entre ${String(MIN_YEAR)} y ${String(MAX_YEAR)}.`,
    ),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const FORM_ID = 'year-form';

/** Crear (sin `year`) o cambiar el número de un año lectivo. */
function YearFormDialog({ year, onDone }: { year?: AcademicYear; onDone: () => void }) {
  const create = useCreateAcademicYear();
  const update = useUpdateAcademicYear();
  const mutation = year ? update : create;
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { year: String(year?.year ?? new Date().getFullYear()) },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((body) => {
    const options = {
      onSuccess: () => {
        toast.success(year ? 'Año lectivo guardado.' : `Año ${String(body.year)} creado.`);
        onDone();
      },
    };
    if (year) update.mutate({ id: year.id, body }, options);
    else create.mutate(body, options);
  });

  return (
    <DialogContent
      title={year ? 'Cambiar el año' : 'Nuevo año lectivo'}
      description={
        year
          ? 'Solo se puede cambiar mientras el año no tenga periodos ni cursos.'
          : 'Se crea activo. Después le agregas sus periodos.'
      }
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={FORM_ID} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : year ? 'Guardar cambios' : 'Crear año'}
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
        <Field label="Año" error={errors.year?.message}>
          {(control) => (
            <Input
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              className="sm:w-40"
              {...control}
              {...form.register('year')}
            />
          )}
        </Field>
      </form>
    </DialogContent>
  );
}
