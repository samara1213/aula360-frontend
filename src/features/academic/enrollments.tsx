import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { Course, Enrollment, EnrollmentStatus } from '@/api/types';
import { DataList, Pagination, RowActions, type Column } from '@/components/data/data-list';
import { pickOption, useIdParam, useListParams } from '@/components/data/list-params';
import { ListToolbar, SearchInput, SelectFilter } from '@/components/data/list-toolbar';
import { RowLink } from '@/components/data/row-link';
import { Field } from '@/components/form/field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { formatDate } from '@/lib/format';
import {
  useCreateEnrollment,
  useEnrollment,
  useEnrollments,
  useUpdateEnrollment,
} from './academic-api';
import {
  ENROLLMENT_STATUSES,
  OBSERVATIONS_MAX,
  STATUS_LABELS,
  TRANSITIONS,
} from './enrollment-rules';
import { EnrollmentBadge } from './enrollment-badge';
import { useCourseOptions, useYearFilter } from './options';
import { PersonPicker, YearFilter } from './pickers';

const coursePath = (id: string) => `/academic/courses/${encodeURIComponent(id)}`;
const studentPath = (id: string) => `/people/students/${encodeURIComponent(id)}`;

type Open = { kind: 'create' } | { kind: 'edit'; enrollment: Enrollment } | null;

/** /academic/enrollments */
export function EnrollmentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <EnrollmentsList />
    </div>
  );
}

/**
 * Matrículas: una por estudiante y año lectivo, en un curso de su sede. Con
 * `course`, las de ese curso (pestaña de su ficha); sin él, las de la
 * institución con búsqueda y filtros en la URL. No se borran: se retiran.
 */
export function EnrollmentsList({ course }: { course?: Course }) {
  const list = useListParams();
  const year = useYearFilter();
  const courseFilter = useIdParam('course');
  const statusParam = useStatusParam();
  const courses = useCourseOptions(year.academicYearId, { enabled: !course });
  // Solo un curso que esté entre las opciones (B2 de la 3d-2).
  const courseChoice = pickOption(courseFilter, courses.options, courses.isPending);
  const { page, limit, search } = list.query;
  const query = {
    page,
    limit,
    ...(search ? { search } : {}),
    ...(course
      ? { courseId: course.id }
      : {
          ...(year.academicYearId ? { academicYearId: year.academicYearId } : {}),
          ...(courseChoice.id ? { courseId: courseChoice.id } : {}),
        }),
    ...(statusParam.status ? { status: statusParam.status } : {}),
  };
  const { data, isPending, isFetching, error, refetch } = useEnrollments(query, {
    enabled: course !== undefined || (!year.isPending && !courseChoice.pending),
  });
  // Alcance por sede (la del curso): el backend lo comprueba.
  const can = usePermissions('academic.enrollments');
  const canSeeStudents = usePermissions('people.students').view;
  const canCreate = can.create && (course ? course.academicYear.isActive : true);
  const [open, setOpen] = useState<Open>(null);
  const close = () => {
    setOpen(null);
  };

  const columns: Column<Enrollment>[] = [
    {
      key: 'student',
      header: 'Estudiante',
      cell: (e) => {
        const name = `${e.student.firstName} ${e.student.lastName}`;
        return canSeeStudents ? <RowLink to={studentPath(e.student.id)}>{name}</RowLink> : name;
      },
    },
    { key: 'code', header: 'Código', cell: (e) => e.student.studentCode ?? '—' },
    ...(course
      ? []
      : [
          {
            key: 'course',
            header: 'Curso',
            cell: (e: Enrollment) => (
              <RowLink to={coursePath(e.course.id)}>
                {e.course.name} · {e.course.grade.name}
              </RowLink>
            ),
          },
          { key: 'year', header: 'Año', cell: (e: Enrollment) => e.academicYear.year },
        ]),
    { key: 'date', header: 'Matrícula', cell: (e) => formatDate(e.enrollmentDate) },
    { key: 'status', header: 'Estado', cell: (e) => <EnrollmentBadge status={e.status} /> },
  ];
  const newButton = canCreate && (
    <Button
      onClick={() => {
        setOpen({ kind: 'create' });
      }}
    >
      <Plus aria-hidden="true" />
      Matricular
    </Button>
  );
  const description = course
    ? 'Los estudiantes matriculados en este curso.'
    : 'Una matrícula por estudiante y año lectivo, en un curso de su sede. No se borran: se retiran.';
  const filtered =
    search !== undefined || statusParam.status !== undefined || courseChoice.id !== undefined;

  return (
    <>
      {course ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-muted-foreground">{description}</p>
          {newButton}
        </div>
      ) : (
        <PageHeader title="Matrículas" description={description} actions={newButton} />
      )}
      <ListToolbar>
        <SearchInput
          label="Buscar"
          placeholder="Nombre o código"
          value={list.search}
          onChange={(value) => {
            list.update({ search: value });
          }}
        />
        {!course && <YearFilter filter={year} />}
        {!course && courses.options.length > 0 && (
          <SelectFilter
            label="Curso"
            value={courseChoice.value}
            options={courses.options}
            onChange={courseFilter.set}
          />
        )}
        <SelectFilter
          label="Estado"
          value={statusParam.value}
          options={ENROLLMENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          onChange={statusParam.set}
          className="sm:w-44"
        />
      </ListToolbar>
      <DataList
        label="Matrículas"
        columns={columns}
        rows={data?.data}
        getKey={(e) => e.id}
        isPending={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        empty={
          filtered ? (
            <p>Ninguna matrícula coincide con los filtros.</p>
          ) : (
            <>
              <p className="font-bold">
                {course
                  ? 'Todavía no hay estudiantes matriculados en este curso.'
                  : 'Todavía no hay matrículas en este año.'}
              </p>
              {canCreate && (
                <p className="mt-1 text-muted-foreground">Matricula el primero con «Matricular».</p>
              )}
            </>
          )
        }
        actions={
          can.update
            ? (enrollment) => (
                <RowActions
                  label={`Acciones de la matrícula de ${enrollment.student.firstName} ${enrollment.student.lastName}`}
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      setOpen({ kind: 'edit', enrollment });
                    }}
                  >
                    <Pencil aria-hidden="true" />
                    Editar matrícula
                  </DropdownMenuItem>
                </RowActions>
              )
            : undefined
        }
      />
      <Pagination
        meta={data?.meta}
        noun="matrículas"
        onPage={(next) => {
          list.update({ page: next });
        }}
      />
      <Dialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        {open?.kind === 'create' && (
          <EnrollDialog
            course={course}
            courseOptions={courses.options}
            academicYearId={year.academicYearId}
            onDone={close}
          />
        )}
        {open?.kind === 'edit' && (
          <EditEnrollmentDialog key={open.enrollment.id} id={open.enrollment.id} onDone={close} />
        )}
      </Dialog>
    </>
  );
}

/** Estado de matrícula en la URL (`?state=`): solo uno de los válidos llega a la API. */
function useStatusParam() {
  const [params, setParams] = useSearchParams();
  const value = params.get('state') ?? '';
  const set = (next: string) => {
    setParams((prev) => {
      const updated = new URLSearchParams(prev);
      if (next) updated.set('state', next);
      else updated.delete('state');
      updated.delete('page');
      return updated;
    });
  };
  const status = ENROLLMENT_STATUSES.find((s) => s === value);
  return { value: status ?? '', status, set };
}

/** Matricular a un estudiante en un curso (el de la ficha, o uno del año elegido). */
function EnrollDialog({
  course,
  courseOptions,
  academicYearId,
  onDone,
}: {
  course?: Course;
  courseOptions: { value: string; label: string }[];
  academicYearId?: string;
  onDone: () => void;
}) {
  const create = useCreateEnrollment();
  const [courseId, setCourseId] = useState(course?.id ?? '');
  const [studentId, setStudentId] = useState('');
  const [search, setSearch] = useState('');
  const [observations, setObservations] = useState('');
  const [errors, setErrors] = useState<{
    course?: string;
    student?: string;
    observations?: string;
  }>({});

  const submit = () => {
    const next = {
      ...(courseId ? {} : { course: 'Elige el curso.' }),
      ...(studentId ? {} : { student: 'Elige el estudiante.' }),
      ...(observations.trim().length > OBSERVATIONS_MAX
        ? { observations: `Máximo ${String(OBSERVATIONS_MAX)} caracteres.` }
        : {}),
    };
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    create.mutate(
      { studentId, courseId, observations: observations.trim() || null },
      {
        onSuccess: () => {
          toast.success('Estudiante matriculado.');
          onDone();
        },
      },
    );
  };

  return (
    <DialogContent
      title="Matricular"
      description={
        course
          ? `En el curso ${course.name}. El estudiante debe estar en la sede ${course.campus.name}.`
          : 'El estudiante debe estar en la sede del curso y no tener otra matrícula en el mismo año.'
      }
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form="enroll-form" disabled={create.isPending}>
            {create.isPending ? 'Matriculando…' : 'Matricular'}
          </Button>
        </>
      }
    >
      <form
        id="enroll-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-5"
      >
        {create.isError && <Alert variant="error">{errorMessage(create.error)}</Alert>}
        <PersonPicker
          kind="students"
          search={search}
          onSearch={setSearch}
          value={studentId}
          onChange={setStudentId}
          error={errors.student}
        />
        {!course && (
          <Field
            label="Curso"
            error={errors.course}
            hint={
              academicYearId === undefined
                ? 'Elige un año lectivo en el filtro para ver sus cursos.'
                : undefined
            }
          >
            {(control) => (
              <NativeSelect
                {...control}
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                }}
              >
                <option value="">
                  {courseOptions.length === 0 ? 'No hay cursos' : 'Elige el curso'}
                </option>
                {courseOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        )}
        <ObservationsField
          value={observations}
          onChange={setObservations}
          error={errors.observations}
        />
      </form>
    </DialogContent>
  );
}

function ObservationsField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <Field
      label="Observaciones (opcional)"
      error={error}
      hint="No escribas datos de salud, disciplinarios ni otros datos sensibles del estudiante."
    >
      {(control) => (
        <Textarea
          rows={3}
          maxLength={OBSERVATIONS_MAX}
          {...control}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
      )}
    </Field>
  );
}

/**
 * Editar una matrícula: estado (solo los cambios permitidos), curso (del
 * mismo año, si está vigente o se reintegra) y observaciones. Lee el detalle
 * para traer las observaciones; envía solo lo que cambió.
 */
function EditEnrollmentDialog({ id, onDone }: { id: string; onDone: () => void }) {
  const detail = useEnrollment(id);
  const update = useUpdateEnrollment();
  return (
    <DialogContent
      title="Editar matrícula"
      description={
        detail.data
          ? `${detail.data.student.firstName} ${detail.data.student.lastName} · Año lectivo ${String(detail.data.academicYear.year)}`
          : undefined
      }
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form="enrollment-form" disabled={!detail.data || update.isPending}>
            {update.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      {detail.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-11" />
          <Skeleton className="h-24" />
        </div>
      ) : detail.error ? (
        <Alert variant="error">{errorMessage(detail.error)}</Alert>
      ) : (
        <EnrollmentForm enrollment={detail.data} update={update} onDone={onDone} />
      )}
    </DialogContent>
  );
}

function EnrollmentForm({
  enrollment,
  update,
  onDone,
}: {
  enrollment: Enrollment;
  update: ReturnType<typeof useUpdateEnrollment>;
  onDone: () => void;
}) {
  const [status, setStatus] = useState<EnrollmentStatus>(enrollment.status);
  const [courseId, setCourseId] = useState(enrollment.course.id);
  const [observations, setObservations] = useState(enrollment.observations ?? '');
  const [error, setError] = useState<string>();
  const courses = useCourseOptions(enrollment.academicYear.id);
  // El curso cambia si la matrícula queda vigente (o se reintegra en el mismo cambio).
  const canMove = status === 'ENROLLED' || status === 'SUSPENDED';
  const sameCampus = courses.courses
    .filter((c) => c.campus.id === enrollment.course.campus.id)
    .map((c) => ({ value: c.id, label: `${c.name} · ${c.grade.name}` }));
  const courseOptions = sameCampus.some((c) => c.value === enrollment.course.id)
    ? sameCampus
    : [
        {
          value: enrollment.course.id,
          label: `${enrollment.course.name} · ${enrollment.course.grade.name}`,
        },
        ...sameCampus,
      ];
  const statusOptions = [enrollment.status, ...TRANSITIONS[enrollment.status]];

  return (
    <form
      id="enrollment-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (observations.trim().length > OBSERVATIONS_MAX) {
          setError(`Máximo ${String(OBSERVATIONS_MAX)} caracteres.`);
          return;
        }
        const body = {
          ...(status !== enrollment.status ? { status } : {}),
          ...(canMove && courseId !== enrollment.course.id ? { courseId } : {}),
          ...((observations.trim() || null) !== (enrollment.observations ?? null)
            ? { observations: observations.trim() || null }
            : {}),
        };
        if (Object.keys(body).length === 0) {
          onDone();
          return;
        }
        update.mutate(
          { id: enrollment.id, body },
          {
            onSuccess: () => {
              toast.success('Matrícula guardada.');
              onDone();
            },
          },
        );
      }}
      className="flex flex-col gap-5"
    >
      {update.isError && <Alert variant="error">{errorMessage(update.error)}</Alert>}
      <Field
        label="Estado"
        hint={
          enrollment.status === 'GRADUATED'
            ? 'Graduado es definitivo: ya no cambia.'
            : 'Retirado se puede reintegrar después. Graduado es definitivo.'
        }
      >
        {(control) => (
          <NativeSelect
            {...control}
            value={status}
            disabled={statusOptions.length === 1}
            onChange={(e) => {
              setStatus(e.target.value as EnrollmentStatus);
            }}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <Field
        label="Curso"
        hint={
          canMove
            ? 'Solo cursos del mismo año y de la sede del estudiante.'
            : 'El curso solo cambia mientras la matrícula está vigente.'
        }
      >
        {(control) => (
          <NativeSelect
            {...control}
            value={courseId}
            disabled={!canMove || !courses.allowed || courses.isPending}
            onChange={(e) => {
              setCourseId(e.target.value);
            }}
          >
            {courseOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <ObservationsField value={observations} onChange={setObservations} error={error} />
    </form>
  );
}
