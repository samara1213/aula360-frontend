import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpenCheck, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { z } from '@/lib/zod';
import { errorMessage } from '@/api/errors';
import type { Course } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataList, Pagination, RowActions, type Column } from '@/components/data/data-list';
import { pickOption, useIdParam, useListParams } from '@/components/data/list-params';
import { ListToolbar, SearchInput, SelectFilter } from '@/components/data/list-toolbar';
import { RowLink } from '@/components/data/row-link';
import { DetailPage } from '@/components/detail-page';
import { Field } from '@/components/form/field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input, NativeSelect } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { useCampusChoices, useCampusFilter } from '@/features/people/campus-choices';
import { CampusFilter } from '@/features/people/person-fields';
import { isUuid } from '@/lib/ids';
import {
  useCourse,
  useCourses,
  useDeleteCourse,
  useForgetCourse,
  useSaveCourse,
  useYearChoices,
} from './academic-api';
import { AssignmentsList } from './assignments';
import { EnrollmentsList } from './enrollments';
import { useCatalogOptions, useYearFilter } from './options';
import { YearFilter } from './pickers';

const coursePath = (id: string) => `/academic/courses/${encodeURIComponent(id)}`;

type Open = { kind: 'create' } | { kind: 'edit' | 'delete'; course: Course } | null;

const COLUMNS: Column<Course>[] = [
  {
    key: 'name',
    header: 'Curso',
    cell: (c) => <RowLink to={coursePath(c.id)}>{c.name}</RowLink>,
  },
  { key: 'grade', header: 'Grado', cell: (c) => c.grade.name },
  { key: 'campus', header: 'Sede', cell: (c) => c.campus.name },
  { key: 'year', header: 'Año', cell: (c) => c.academicYear.year },
];

/** /academic/courses */
export function CoursesPage() {
  const list = useListParams();
  const year = useYearFilter();
  const grade = useIdParam('grade');
  const campus = useCampusFilter();
  const grades = useCatalogOptions('grades');
  const campuses = useCampusChoices('academic.courses');
  // Solo ids que estén entre las opciones (B2 de la 3d-2).
  const gradeFilter = pickOption(grade, grades.options, grades.isPending);
  const campusFilter = pickOption(
    { value: campus.value, id: campus.campusId },
    campuses.options,
    campuses.isPending,
  );
  const { page, limit, search } = list.query;
  const query = {
    page,
    limit,
    ...(search ? { search } : {}),
    ...(year.academicYearId ? { academicYearId: year.academicYearId } : {}),
    ...(gradeFilter.id ? { gradeId: gradeFilter.id } : {}),
    ...(campusFilter.id ? { campusId: campusFilter.id } : {}),
  };
  // Hasta saber el año predeterminado no se pide la lista (saldrían todos los años).
  const { data, isPending, isFetching, error, refetch } = useCourses(query, {
    enabled: !year.isPending && !gradeFilter.pending && !campusFilter.pending,
  });
  // Cursos con alcance por sede: el permiso de la sede basta (el backend lo comprueba).
  const can = usePermissions('academic.courses');
  const [open, setOpen] = useState<Open>(null);
  const close = () => {
    setOpen(null);
  };
  const filtered =
    search !== undefined || gradeFilter.id !== undefined || campusFilter.id !== undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cursos"
        description="Cada curso es un grupo de un grado, en una sede y un año lectivo. Ahí se asignan los docentes y se matriculan los estudiantes."
        actions={
          can.create && (
            <Button
              onClick={() => {
                setOpen({ kind: 'create' });
              }}
            >
              <Plus aria-hidden="true" />
              Nuevo curso
            </Button>
          )
        }
      />
      <ListToolbar>
        <SearchInput
          label="Buscar"
          placeholder="Nombre del curso"
          value={list.search}
          onChange={(value) => {
            list.update({ search: value });
          }}
        />
        <YearFilter filter={year} />
        {grades.options.length > 0 && (
          <SelectFilter
            label="Grado"
            value={gradeFilter.value}
            options={grades.options}
            onChange={grade.set}
            className="sm:w-44"
          />
        )}
        <CampusFilter value={campusFilter.value} options={campuses.options} onChange={campus.set} />
      </ListToolbar>
      <DataList
        label="Cursos"
        columns={COLUMNS}
        rows={data?.data}
        getKey={(c) => c.id}
        isPending={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        empty={
          filtered ? (
            <p>Ningún curso coincide con los filtros.</p>
          ) : (
            <>
              <p className="font-bold">Todavía no hay cursos en este año.</p>
              {can.create && (
                <p className="mt-1 text-muted-foreground">Crea el primero con «Nuevo curso».</p>
              )}
            </>
          )
        }
        actions={
          can.update || can.delete
            ? (course) => (
                <RowActions label={`Acciones de ${course.name}`}>
                  <CourseMenuItems course={course} can={can} onOpen={setOpen} />
                </RowActions>
              )
            : undefined
        }
      />
      <Pagination
        meta={data?.meta}
        noun="cursos"
        onPage={(next) => {
          list.update({ page: next });
        }}
      />
      <CourseDialogs open={open} onClose={close} />
    </div>
  );
}

function CourseMenuItems({
  course,
  can,
  onOpen,
}: {
  course: Course;
  can: { update: boolean; delete: boolean };
  onOpen: (open: Open) => void;
}) {
  return (
    <>
      {can.update && (
        <DropdownMenuItem
          onSelect={() => {
            onOpen({ kind: 'edit', course });
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
            onOpen({ kind: 'delete', course });
          }}
        >
          <Trash2 aria-hidden="true" />
          Eliminar
        </DropdownMenuItem>
      )}
    </>
  );
}

function CourseDialogs({
  open,
  onClose,
  onDeleted,
}: {
  open: Open;
  onClose: () => void;
  /** Desde la ficha: salir de ella (la ficha se quita de la caché después). */
  onDeleted?: () => void | Promise<void>;
}) {
  const remove = useDeleteCourse();
  const forget = useForgetCourse();
  return (
    <>
      <Dialog
        open={open?.kind === 'create' || open?.kind === 'edit'}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        {(open?.kind === 'create' || open?.kind === 'edit') && (
          <CourseFormDialog
            key={open.kind === 'edit' ? open.course.id : 'new'}
            course={open.kind === 'edit' ? open.course : undefined}
            onDone={onClose}
          />
        )}
      </Dialog>
      {open?.kind === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) onClose();
          }}
          title={`¿Eliminar el curso ${open.course.name}?`}
          description="Solo se puede eliminar un curso sin carga académica, matrículas ni boletines. Esta acción no se puede deshacer."
          confirmLabel="Eliminar curso"
          pendingLabel="Eliminando…"
          destructive
          pending={remove.isPending}
          onConfirm={() => {
            const { course } = open;
            remove.mutate(course.id, {
              onSuccess: () => {
                toast.success(`El curso ${course.name} se eliminó.`);
                onClose();
                void Promise.resolve(onDeleted?.()).then(() => {
                  forget(course.id);
                });
              },
              onError: (err) => toast.error(errorMessage(err)),
            });
          }}
        />
      )}
    </>
  );
}

/** /academic/courses/:id: el curso, su carga académica y sus estudiantes (`?tab=`). */
export function CourseDetail({ id }: { id: string }) {
  const query = useCourse(id);
  return (
    <DetailPage
      back={{ to: '/academic/courses', label: 'Cursos' }}
      validId={isUuid(id)}
      query={query}
      noun="el curso"
    >
      {(course) => <CourseContent course={course} />}
    </DetailPage>
  );
}

function CourseContent({ course }: { course: Course }) {
  const can = usePermissions('academic.courses');
  const load = usePermissions('academic.teacher-assignments');
  const enrollments = usePermissions('academic.enrollments');
  const navigate = useNavigate();
  const [open, setOpen] = useState<Open>(null);
  const [params, setParams] = useSearchParams();
  const tabs = [
    ...(load.view ? (['load'] as const) : []),
    ...(enrollments.view ? (['students'] as const) : []),
  ];
  const requested = params.get('tab');
  const tab = tabs.find((t) => t === requested) ?? tabs[0];

  return (
    <>
      <PageHeader
        title={`Curso ${course.name}`}
        description={`${course.grade.name} · ${course.campus.name} · Año lectivo ${String(course.academicYear.year)}${course.academicYear.isActive ? '' : ' (inactivo)'}`}
        actions={
          <>
            {can.update && (
              <Button
                variant="outline"
                onClick={() => {
                  setOpen({ kind: 'edit', course });
                }}
              >
                <Pencil aria-hidden="true" />
                Editar
              </Button>
            )}
            {can.delete && (
              <Button
                variant="outline"
                onClick={() => {
                  setOpen({ kind: 'delete', course });
                }}
              >
                <Trash2 aria-hidden="true" />
                Eliminar
              </Button>
            )}
          </>
        }
      />
      {tab && (
        <Tabs
          value={tab}
          onValueChange={(next) => {
            // Cada pestaña empieza sin los filtros de la otra.
            setParams(next === tabs[0] ? {} : { tab: next }, { replace: true });
          }}
        >
          <TabsList aria-label="Secciones del curso">
            {load.view && (
              <TabsTrigger value="load">
                <BookOpenCheck aria-hidden="true" />
                Carga académica
              </TabsTrigger>
            )}
            {enrollments.view && (
              <TabsTrigger value="students">
                <Users aria-hidden="true" />
                Estudiantes
              </TabsTrigger>
            )}
          </TabsList>
          {load.view && (
            <TabsContent value="load">
              <AssignmentsList course={course} />
            </TabsContent>
          )}
          {enrollments.view && (
            <TabsContent value="students">
              <EnrollmentsList course={course} />
            </TabsContent>
          )}
        </Tabs>
      )}
      <CourseDialogs
        open={open}
        onClose={() => {
          setOpen(null);
        }}
        onDeleted={() => navigate('/academic/courses', { replace: true })}
      />
    </>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del curso.').max(100, 'Máximo 100 caracteres.'),
  gradeId: z.string().min(1, 'Elige el grado.'),
  campusId: z.string().min(1, 'Elige la sede.'),
  academicYearId: z.string().min(1, 'Elige el año lectivo.'),
});
type FormValues = z.infer<typeof schema>;

const FORM_ID = 'course-form';

/**
 * Crear (sin `course`) o editar un curso. Solo se ofrecen años y sedes
 * activos (y los actuales del curso, aunque ya no lo estén). Al editar se
 * envía solo lo que cambió: el grado, la sede y el año no cambian si el curso
 * ya tiene carga o matrículas (lo dice el backend).
 */
function CourseFormDialog({ course, onDone }: { course?: Course; onDone: () => void }) {
  const save = useSaveCourse();
  const grades = useCatalogOptions('grades');
  const campuses = useCampusChoices('academic.courses');
  const canListYears = usePermissions('academic.years').view;
  const years = useYearChoices({ enabled: canListYears });
  const yearOptions = (years.data?.data ?? [])
    .filter((y) => y.isActive || y.id === course?.academicYear.id)
    .map((y) => ({ value: y.id, label: `${String(y.year)}${y.isActive ? '' : ' (inactivo)'}` }));
  if (course && !yearOptions.some((y) => y.value === course.academicYear.id)) {
    const { id, year, isActive } = course.academicYear;
    yearOptions.push({ value: id, label: `${String(year)}${isActive ? '' : ' (inactivo)'}` });
  }
  const campusOptions = [
    ...campuses.options,
    ...(course && !campuses.options.some((c) => c.value === course.campus.id)
      ? [{ value: course.campus.id, label: `${course.campus.name} (inactiva)` }]
      : []),
  ];
  const gradeOptions = [
    ...grades.options,
    ...(course && !grades.options.some((g) => g.value === course.grade.id)
      ? [{ value: course.grade.id, label: course.grade.name }]
      : []),
  ];
  // Los selectores se montan con sus opciones ya cargadas: si no, perderían el valor.
  const ready = !grades.isPending && !campuses.isPending && !(canListYears && years.isPending);

  return (
    <DialogContent
      title={course ? `Editar el curso ${course.name}` : 'Nuevo curso'}
      description={
        course
          ? 'El grado, la sede y el año solo cambian mientras el curso no tenga carga académica ni matrículas.'
          : 'Solo en años lectivos y sedes activos.'
      }
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={FORM_ID} disabled={save.isPending || !ready}>
            {save.isPending ? 'Guardando…' : course ? 'Guardar cambios' : 'Crear curso'}
          </Button>
        </>
      }
    >
      {ready ? (
        <CourseForm
          course={course}
          save={save}
          onDone={onDone}
          options={{ grades: gradeOptions, campuses: campusOptions, years: yearOptions }}
          blocked={{
            grades: grades.forbidden,
            campuses: campuses.forbidden,
            years: !canListYears || years.isError,
          }}
        />
      ) : (
        <p className="text-muted-foreground" aria-busy="true">
          Cargando opciones…
        </p>
      )}
    </DialogContent>
  );
}

type Option = { value: string; label: string };

function CourseForm({
  course,
  save,
  onDone,
  options,
  blocked,
}: {
  course?: Course;
  save: ReturnType<typeof useSaveCourse>;
  onDone: () => void;
  options: { grades: Option[]; campuses: Option[]; years: Option[] };
  blocked: { grades: boolean; campuses: boolean; years: boolean };
}) {
  const [params] = useSearchParams();
  // Al crear, el año y la sede del filtro del listado (si son de las opciones).
  const pick = (list: Option[], wanted: string | null) =>
    list.find((o) => o.value === wanted)?.value ?? list[0]?.value ?? '';
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: course
      ? {
          name: course.name,
          gradeId: course.grade.id,
          campusId: course.campus.id,
          academicYearId: course.academicYear.id,
        }
      : {
          name: '',
          gradeId: '',
          campusId:
            options.campuses.length === 1
              ? (options.campuses[0]?.value ?? '')
              : (options.campuses.find((o) => o.value === params.get('campus'))?.value ?? ''),
          academicYearId: pick(options.years, params.get('year')),
        },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    const options = {
      onSuccess: () => {
        toast.success(course ? 'Curso guardado.' : `Curso ${values.name} creado.`);
        onDone();
      },
    };
    if (course) {
      const current: FormValues = {
        name: course.name,
        gradeId: course.grade.id,
        campusId: course.campus.id,
        academicYearId: course.academicYear.id,
      };
      const body = Object.fromEntries(
        Object.entries(values).filter(
          ([field, value]) => current[field as keyof FormValues] !== value,
        ),
      );
      if (Object.keys(body).length === 0) {
        onDone();
        return;
      }
      save.mutate({ id: course.id, body }, options);
    } else {
      save.mutate({ body: values }, options);
    }
  });

  const select = (
    name: 'gradeId' | 'campusId' | 'academicYearId',
    label: string,
    list: Option[],
    placeholder: string,
    forbiddenHint: string,
    isBlocked: boolean,
  ) => (
    <Field label={label} error={errors[name]?.message} hint={isBlocked ? forbiddenHint : undefined}>
      {(control) => (
        <NativeSelect {...control} {...form.register(name)} disabled={isBlocked}>
          <option value="">{list.length === 0 ? `No hay opciones` : placeholder}</option>
          {list.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      )}
    </Field>
  );

  return (
    <form
      id={FORM_ID}
      noValidate
      onSubmit={(e) => void onSubmit(e)}
      className="flex flex-col gap-5"
    >
      {save.isError && <Alert variant="error">{errorMessage(save.error)}</Alert>}
      <Field label="Nombre" error={errors.name?.message} hint="Por ejemplo, 601 o Sexto A.">
        {(control) => <Input autoComplete="off" {...control} {...form.register('name')} />}
      </Field>
      {select(
        'gradeId',
        'Grado',
        options.grades,
        'Elige el grado',
        'Para elegir el grado necesitas también el permiso de ver Grados.',
        blocked.grades,
      )}
      {select(
        'campusId',
        'Sede',
        options.campuses,
        'Elige la sede',
        'Para elegir la sede necesitas también el permiso de Sedes.',
        blocked.campuses,
      )}
      {select(
        'academicYearId',
        'Año lectivo',
        options.years,
        'Elige el año lectivo',
        'Para elegir el año necesitas también el permiso de ver Años lectivos.',
        blocked.years,
      )}
    </form>
  );
}
