import type { StudentSummary, Teacher } from '@/api/types';
import { SearchInput, SelectFilter } from '@/components/data/list-toolbar';
import { Field } from '@/components/form/field';
import { NativeSelect } from '@/components/ui/input';
import { usePermissions } from '@/features/menu/menu';
import { useStudents, useTeachers } from '@/features/people/people-api';
import { isForbidden, teacherName, type useYearFilter } from './options';

// Selectores y filtros que comparten cursos, carga académica y matrículas.

export function YearFilter({ filter }: { filter: ReturnType<typeof useYearFilter> }) {
  if (!filter.available) return null;
  return (
    <SelectFilter
      label="Año lectivo"
      value={filter.value}
      options={[...filter.options, { value: 'all', label: 'Todos los años' }]}
      onChange={filter.set}
      allLabel={null}
      className="sm:w-44"
    />
  );
}

/**
 * Elegir un docente o un estudiante activo buscándolo por nombre o documento:
 * la búsqueda trae los 20 primeros. Sin el permiso de Personas para listarlos
 * se dice cuál falta.
 */
export function PersonPicker({
  kind,
  search,
  onSearch,
  value,
  onChange,
  error,
  exclude,
}: {
  kind: 'teachers' | 'students';
  search: string;
  onSearch: (search: string) => void;
  value: string;
  onChange: (id: string) => void;
  error?: string;
  /** Id que no se ofrece (p. ej. el docente actual al reemplazar). */
  exclude?: string;
}) {
  const isTeachers = kind === 'teachers';
  const canView = usePermissions(isTeachers ? 'people.teachers' : 'people.students').view;
  const query = { page: 1, limit: 20, isActive: true, ...(search ? { search } : {}) };
  const teachers = useTeachers(query, { enabled: canView && isTeachers });
  const students = useStudents(query, { enabled: canView && !isTeachers });
  const result = isTeachers ? teachers : students;
  const label = isTeachers ? 'Docente' : 'Estudiante';

  if (!canView || isForbidden(result.error)) {
    return (
      <Field
        label={label}
        error={error}
        hint={`Para elegir ${isTeachers ? 'un docente' : 'un estudiante'} necesitas también el permiso de ver ${isTeachers ? 'Docentes' : 'Estudiantes'}.`}
      >
        {(control) => (
          <NativeSelect {...control} disabled>
            <option>Sin acceso</option>
          </NativeSelect>
        )}
      </Field>
    );
  }

  const rows = (result.data?.data ?? []) as (Teacher | StudentSummary)[];
  const options = rows
    .filter((row) => row.id !== exclude)
    .map((row) => ({
      value: row.id,
      label:
        'studentCode' in row
          ? `${teacherName(row.user)}${row.studentCode ? ` (${row.studentCode})` : ''}${row.campus ? ` · ${row.campus.name}` : ''}`
          : `${teacherName(row.user)} · ${row.user.documentType} ${row.user.documentNumber}`,
    }));
  const total = result.data?.meta.total ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        label={`Buscar ${label.toLowerCase()}`}
        placeholder={isTeachers ? 'Nombre o documento' : 'Nombre, documento o código'}
        value={search}
        onChange={(next) => {
          // Otra búsqueda: la elección anterior puede no estar entre los resultados.
          onSearch(next);
          onChange('');
        }}
      />
      <Field
        label={label}
        error={error}
        hint={
          total > options.length && options.length > 0
            ? `Se muestran ${String(options.length)} de ${String(total)}. Escribe más para encontrarlo.`
            : undefined
        }
      >
        {(control) => (
          <NativeSelect
            {...control}
            value={options.some((option) => option.value === value) ? value : ''}
            disabled={result.isPending}
            onChange={(e) => {
              onChange(e.target.value);
            }}
          >
            <option value="">
              {result.isPending
                ? 'Cargando…'
                : options.length === 0
                  ? 'Nadie coincide con la búsqueda'
                  : `Elige ${isTeachers ? 'un docente' : 'un estudiante'}`}
            </option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
    </div>
  );
}
