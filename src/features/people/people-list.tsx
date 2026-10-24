import type { UseQueryResult } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { PageMeta } from '@/api/types';
import { DataList, Pagination, type Column } from '@/components/data/data-list';
import { pickOption, useIdParam, useListParams } from '@/components/data/list-params';
import {
  ListToolbar,
  SearchInput,
  SelectFilter,
  StatusSelect,
} from '@/components/data/list-toolbar';
import { useCourseOptions, useDefaultYear } from '@/features/academic/options';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { PendingInvitations } from './pending-invitations';
import { useCampusChoices, useCampusFilter, type PeopleSlug } from './campus-choices';
import { CampusFilter } from './person-fields';
import type { PeopleQuery } from './people-api';

const MALE: readonly [string, string] = ['Activos', 'Inactivos'];

/**
 * Listado de docentes o estudiantes de la institución activa: búsqueda,
 * estado y sede en la URL; «Nuevo …» abre el diálogo de alta y, al terminar,
 * va a la ficha creada.
 */
export function PeopleList<T extends { id: string }>({
  slug,
  title,
  description,
  noun,
  newLabel,
  searchPlaceholder,
  columns,
  useRows,
  detailPath,
  createDialog,
  filterByCourse = false,
}: {
  slug: PeopleSlug;
  title: string;
  description: string;
  /** En plural y minúscula: «docentes». */
  noun: string;
  newLabel: string;
  searchPlaceholder: string;
  columns: Column<T>[];
  useRows: (
    query: PeopleQuery,
    options?: { enabled?: boolean },
  ) => UseQueryResult<{ data: T[]; meta: PageMeta }>;
  detailPath: (id: string) => string;
  createDialog: (onDone: (createdId?: string) => void) => ReactNode;
  /** Estudiantes: filtro por curso (`?course=`) entre los del año activo. */
  filterByCourse?: boolean;
}) {
  const list = useListParams();
  const campus = useCampusFilter();
  const campuses = useCampusChoices(slug);
  const course = useIdParam('course');
  // Los cursos del año activo; sin permiso de ver Años lectivos (docentes), los de todos.
  const defaultYear = useDefaultYear({ enabled: filterByCourse });
  const courses = useCourseOptions(defaultYear.year?.id, {
    enabled: filterByCourse,
    anyYear: !defaultYear.canList,
  });
  // Solo ids que estén entre las opciones: un curso solo con permiso de ver
  // Cursos y si es uno de los suyos (B1 y B2 de la 3d-2).
  const campusChoice = pickOption(
    { value: campus.value, id: campus.campusId },
    campuses.options,
    campuses.isPending,
  );
  const courseChoice = pickOption(course, courses.options, courses.isPending);
  const { data, isPending, isFetching, error, refetch } = useRows(
    {
      ...list.query,
      ...(campusChoice.id ? { campusId: campusChoice.id } : {}),
      ...(filterByCourse && courseChoice.id ? { courseId: courseChoice.id } : {}),
    },
    { enabled: !campusChoice.pending && !(filterByCourse && courseChoice.pending) },
  );
  const can = usePermissions(slug);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const filtered =
    list.search !== '' ||
    list.status !== 'active' ||
    campusChoice.id !== undefined ||
    courseChoice.id !== undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          can.create && (
            <Button
              onClick={() => {
                setCreating(true);
              }}
            >
              <Plus aria-hidden="true" />
              {newLabel}
            </Button>
          )
        }
      />
      <ListToolbar>
        <SearchInput
          label="Buscar"
          placeholder={searchPlaceholder}
          value={list.search}
          onChange={(search) => {
            list.update({ search });
          }}
        />
        <StatusSelect
          value={list.status}
          labels={[...MALE, 'Todos']}
          onChange={(status) => {
            list.update({ status });
          }}
        />
        <CampusFilter value={campusChoice.value} options={campuses.options} onChange={campus.set} />
        {filterByCourse && courses.options.length > 0 && (
          <SelectFilter
            label={defaultYear.year ? `Curso (${String(defaultYear.year.year)})` : 'Curso'}
            value={courseChoice.value}
            options={courses.options}
            onChange={course.set}
          />
        )}
      </ListToolbar>
      <DataList
        label={title}
        columns={columns}
        rows={data?.data}
        getKey={(row) => row.id}
        isPending={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        empty={
          filtered ? (
            <p>Nadie coincide con la búsqueda.</p>
          ) : (
            <>
              <p className="font-bold">Todavía no hay {noun}.</p>
              {can.create && (
                <p className="mt-1 text-muted-foreground">Crea el primero con «{newLabel}».</p>
              )}
            </>
          )
        }
      />
      <Pagination
        meta={data?.meta}
        noun={noun}
        onPage={(page) => {
          list.update({ page });
        }}
      />
      {can.create && (
        <PendingInvitations kind={slug === 'people.teachers' ? 'teachers' : 'students'} />
      )}
      <Dialog open={creating} onOpenChange={setCreating}>
        {creating &&
          createDialog((createdId) => {
            setCreating(false);
            if (createdId) void navigate(detailPath(createdId));
          })}
      </Dialog>
    </div>
  );
}
