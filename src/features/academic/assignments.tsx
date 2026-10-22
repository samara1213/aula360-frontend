import { Plus, PowerOff, Trash2, UserRoundCog } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { Course, TeacherAssignment } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataList, Pagination, RowActions, type Column } from '@/components/data/data-list';
import { PAGE_SIZE, pickOption, useIdParam, useListParams } from '@/components/data/list-params';
import { ListToolbar, SelectFilter, StatusSelect } from '@/components/data/list-toolbar';
import { RowLink } from '@/components/data/row-link';
import { Field } from '@/components/form/field';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { NativeSelect } from '@/components/ui/input';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { formatDate } from '@/lib/format';
import {
  useCreateTeacherAssignment,
  useDeactivateAssignment,
  useDeleteAssignment,
  useReplaceTeacher,
  useTeacherAssignments,
} from './academic-api';
import { teacherName, useCatalogOptions, useCourseOptions, useYearFilter } from './options';
import { PersonPicker, YearFilter } from './pickers';

const ASSIGNMENT_LABELS: readonly [string, string] = ['Vigente', 'Terminada'];

const coursePath = (id: string) => `/academic/courses/${encodeURIComponent(id)}`;

type Open =
  | { kind: 'create' }
  | { kind: 'replace' | 'deactivate' | 'delete'; assignment: TeacherAssignment }
  | null;

/** /academic/teacher-assignments */
export function AssignmentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AssignmentsList />
    </div>
  );
}

/**
 * Carga académica: docente + materia + curso. Con `course`, la de ese curso
 * (pestaña de su ficha); sin él, la de la institución con filtros en la URL.
 * Un solo docente vigente por materia y curso: cambiarlo termina la
 * asignación anterior y la conserva en el historial.
 */
export function AssignmentsList({ course }: { course?: Course }) {
  const list = useListParams();
  const year = useYearFilter();
  const courseFilter = useIdParam('course');
  const subject = useIdParam('subject');
  const subjects = useCatalogOptions('subjects');
  const courses = useCourseOptions(year.academicYearId, { enabled: !course });
  // Solo ids que estén entre las opciones (B2 de la 3d-2).
  const courseChoice = pickOption(courseFilter, courses.options, courses.isPending);
  const subjectChoice = pickOption(subject, subjects.options, subjects.isPending);
  const query = {
    page: list.page,
    limit: PAGE_SIZE,
    ...(course
      ? { courseId: course.id }
      : {
          ...(year.academicYearId ? { academicYearId: year.academicYearId } : {}),
          ...(courseChoice.id ? { courseId: courseChoice.id } : {}),
        }),
    ...(subjectChoice.id ? { subjectId: subjectChoice.id } : {}),
    ...(list.status === 'all' ? {} : { isActive: list.status === 'active' }),
  };
  const { data, isPending, isFetching, error, refetch } = useTeacherAssignments(query, {
    enabled:
      (course !== undefined || (!year.isPending && !courseChoice.pending)) &&
      !subjectChoice.pending,
  });
  // Alcance por sede (la del curso): el backend lo comprueba.
  const can = usePermissions('academic.teacher-assignments');
  // El año del curso debe estar activo para asignar.
  const canCreate = can.create && (course ? course.academicYear.isActive : true);
  const [open, setOpen] = useState<Open>(null);
  const close = () => {
    setOpen(null);
  };

  const columns: Column<TeacherAssignment>[] = [
    { key: 'subject', header: 'Materia', cell: (a) => a.subject.name },
    { key: 'teacher', header: 'Docente', cell: (a) => teacherName(a.teacher) },
    ...(course
      ? []
      : [
          {
            key: 'course',
            header: 'Curso',
            cell: (a: TeacherAssignment) => (
              <RowLink to={coursePath(a.course.id)}>
                {a.course.name} · {a.course.grade.name}
              </RowLink>
            ),
          },
        ]),
    {
      key: 'since',
      header: 'Desde',
      cell: (a) =>
        a.deactivatedAt
          ? `${formatDate(a.createdAt)} al ${formatDate(a.deactivatedAt)}`
          : formatDate(a.createdAt),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (a) => <StatusBadge active={a.isActive} labels={ASSIGNMENT_LABELS} />,
    },
  ];
  const newButton = canCreate && (
    <Button
      onClick={() => {
        setOpen({ kind: 'create' });
      }}
    >
      <Plus aria-hidden="true" />
      Asignar materia
    </Button>
  );
  const description = course
    ? 'Qué docente dicta cada materia en este curso. Cambiar el docente conserva el historial.'
    : 'Qué docente dicta cada materia en cada curso. Cambiar el docente conserva el historial.';

  return (
    <>
      {course ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-muted-foreground">{description}</p>
          {newButton}
        </div>
      ) : (
        <PageHeader title="Carga académica" description={description} actions={newButton} />
      )}
      <ListToolbar>
        {!course && <YearFilter filter={year} />}
        {!course && courses.options.length > 0 && (
          <SelectFilter
            label="Curso"
            value={courseChoice.value}
            options={courses.options}
            onChange={courseFilter.set}
          />
        )}
        {subjects.options.length > 0 && (
          <SelectFilter
            label="Materia"
            value={subjectChoice.value}
            options={subjects.options}
            onChange={subject.set}
            allLabel="Todas"
          />
        )}
        <StatusSelect
          value={list.status}
          labels={['Vigentes', 'Terminadas', 'Todas']}
          onChange={(status) => {
            list.update({ status });
          }}
        />
      </ListToolbar>
      <DataList
        label="Carga académica"
        columns={columns}
        rows={data?.data}
        getKey={(a) => a.id}
        isPending={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        empty={
          <>
            <p className="font-bold">
              {list.status === 'active' && !subjectChoice.id
                ? course
                  ? 'Este curso todavía no tiene materias asignadas.'
                  : 'No hay carga académica con estos filtros.'
                : 'Ninguna asignación coincide con los filtros.'}
            </p>
            {canCreate && list.status === 'active' && (
              <p className="mt-1 text-muted-foreground">Asigna la primera con «Asignar materia».</p>
            )}
          </>
        }
        actions={
          can.update || can.delete
            ? (assignment) => (
                <RowActions
                  label={`Acciones de ${assignment.subject.name} con ${teacherName(assignment.teacher)}`}
                >
                  {can.update && assignment.isActive && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setOpen({ kind: 'replace', assignment });
                      }}
                    >
                      <UserRoundCog aria-hidden="true" />
                      Cambiar docente
                    </DropdownMenuItem>
                  )}
                  {can.update && assignment.isActive && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setOpen({ kind: 'deactivate', assignment });
                      }}
                    >
                      <PowerOff aria-hidden="true" />
                      Terminar
                    </DropdownMenuItem>
                  )}
                  {can.delete && (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        setOpen({ kind: 'delete', assignment });
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
      <Pagination
        meta={data?.meta}
        noun="asignaciones"
        onPage={(page) => {
          list.update({ page });
        }}
      />
      <AssignmentDialogs
        open={open}
        onClose={close}
        course={course}
        courseOptions={courses.options}
        academicYearId={year.academicYearId}
      />
    </>
  );
}

function AssignmentDialogs({
  open,
  onClose,
  course,
  courseOptions,
  academicYearId,
}: {
  open: Open;
  onClose: () => void;
  course?: Course;
  courseOptions: { value: string; label: string }[];
  academicYearId?: string;
}) {
  const deactivate = useDeactivateAssignment();
  const remove = useDeleteAssignment();
  const onError = (err: unknown) => toast.error(errorMessage(err));
  return (
    <>
      <Dialog
        open={open?.kind === 'create' || open?.kind === 'replace'}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        {open?.kind === 'create' && (
          <AssignDialog
            course={course}
            courseOptions={courseOptions}
            academicYearId={academicYearId}
            onDone={onClose}
          />
        )}
        {open?.kind === 'replace' && (
          <ReplaceDialog key={open.assignment.id} assignment={open.assignment} onDone={onClose} />
        )}
      </Dialog>
      {open?.kind === 'deactivate' && (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) onClose();
          }}
          title={`¿Terminar ${open.assignment.subject.name} con ${teacherName(open.assignment.teacher)}?`}
          description="La materia queda sin docente en el curso hasta que asignes otro. La asignación se conserva en el historial con la fecha de hoy."
          confirmLabel="Terminar asignación"
          pendingLabel="Terminando…"
          destructive
          pending={deactivate.isPending}
          onConfirm={() => {
            deactivate.mutate(open.assignment.id, {
              onSuccess: () => {
                toast.success('Asignación terminada.');
                onClose();
              },
              onError,
            });
          }}
        />
      )}
      {open?.kind === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) onClose();
          }}
          title={`¿Eliminar ${open.assignment.subject.name} con ${teacherName(open.assignment.teacher)}?`}
          description="Úsalo solo para corregir un error: no queda en el historial. Si la asignación ya tiene evaluaciones, no se puede eliminar; termínala."
          confirmLabel="Eliminar asignación"
          pendingLabel="Eliminando…"
          destructive
          pending={remove.isPending}
          onConfirm={() => {
            remove.mutate(open.assignment.id, {
              onSuccess: () => {
                toast.success('Asignación eliminada.');
                onClose();
              },
              onError,
            });
          }}
        />
      )}
    </>
  );
}

/** Asignar una materia y su docente a un curso (el de la ficha, o uno del año elegido). */
function AssignDialog({
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
  const create = useCreateTeacherAssignment();
  const subjects = useCatalogOptions('subjects');
  const [courseId, setCourseId] = useState(course?.id ?? '');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState<{ course?: string; subject?: string; teacher?: string }>({});

  const submit = () => {
    const next = {
      ...(courseId ? {} : { course: 'Elige el curso.' }),
      ...(subjectId ? {} : { subject: 'Elige la materia.' }),
      ...(teacherId ? {} : { teacher: 'Elige el docente.' }),
    };
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    create.mutate(
      { courseId, subjectId, teacherId },
      {
        onSuccess: () => {
          toast.success('Materia asignada.');
          onDone();
        },
      },
    );
  };

  return (
    <DialogContent
      title="Asignar materia"
      description={
        course
          ? `Al curso ${course.name}. El docente debe tener el rol de docente en la sede del curso.`
          : 'El docente debe tener el rol de docente en la sede del curso.'
      }
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form="assign-form" disabled={create.isPending}>
            {create.isPending ? 'Asignando…' : 'Asignar'}
          </Button>
        </>
      }
    >
      <form
        id="assign-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-5"
      >
        {create.isError && <Alert variant="error">{errorMessage(create.error)}</Alert>}
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
        <Field
          label="Materia"
          error={errors.subject}
          hint={
            subjects.forbidden
              ? 'Para elegir la materia necesitas también el permiso de ver Materias.'
              : undefined
          }
        >
          {(control) => (
            <NativeSelect
              {...control}
              value={subjectId}
              disabled={subjects.forbidden || subjects.isPending}
              onChange={(e) => {
                setSubjectId(e.target.value);
              }}
            >
              <option value="">
                {subjects.isPending
                  ? 'Cargando…'
                  : subjects.options.length === 0
                    ? 'No hay materias'
                    : 'Elige la materia'}
              </option>
              {subjects.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <PersonPicker
          kind="teachers"
          search={search}
          onSearch={setSearch}
          value={teacherId}
          onChange={setTeacherId}
          error={errors.teacher}
        />
      </form>
    </DialogContent>
  );
}

/** Cambiar el docente de una asignación vigente: la anterior queda en el historial. */
function ReplaceDialog({
  assignment,
  onDone,
}: {
  assignment: TeacherAssignment;
  onDone: () => void;
}) {
  const replace = useReplaceTeacher();
  const [teacherId, setTeacherId] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string>();

  return (
    <DialogContent
      title="Cambiar docente"
      description={`${assignment.subject.name} en ${assignment.course.name}. Hoy la dicta ${teacherName(assignment.teacher)}; su asignación queda terminada con la fecha de hoy.`}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form="replace-form" disabled={replace.isPending}>
            {replace.isPending ? 'Cambiando…' : 'Cambiar docente'}
          </Button>
        </>
      }
    >
      <form
        id="replace-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!teacherId) {
            setError('Elige el docente nuevo.');
            return;
          }
          replace.mutate(
            { id: assignment.id, teacherId },
            {
              onSuccess: () => {
                toast.success('Docente cambiado.');
                onDone();
              },
            },
          );
        }}
        className="flex flex-col gap-5"
      >
        {replace.isError && <Alert variant="error">{errorMessage(replace.error)}</Alert>}
        <PersonPicker
          kind="teachers"
          search={search}
          onSearch={setSearch}
          value={teacherId}
          onChange={(id) => {
            setTeacherId(id);
            setError(undefined);
          }}
          error={error}
          exclude={assignment.teacher.id}
        />
      </form>
    </DialogContent>
  );
}
