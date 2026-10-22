import { useParams } from 'react-router';
import type { StudentSummary, Teacher } from '@/api/types';
import type { Column } from '@/components/data/data-list';
import { RowLink } from '@/components/data/row-link';
import { StatusBadge } from '@/components/ui/badge';
import { CreateStudentDialog } from './create-student-dialog';
import { CreateTeacherDialog } from './create-teacher-dialog';
import { useStudents, useTeachers } from './people-api';
import { PeopleList } from './people-list';
import { StudentDetail } from './student-detail';
import { TeacherDetail } from './teacher-detail';

// Pantallas de Personas tal como las monta el router (un solo archivo diferido).

const MALE: readonly [string, string] = ['Activo', 'Inactivo'];
const teacherPath = (id: string) => `/people/teachers/${encodeURIComponent(id)}`;
const studentPath = (id: string) => `/people/students/${encodeURIComponent(id)}`;

const TEACHER_COLUMNS: Column<Teacher>[] = [
  {
    key: 'name',
    header: 'Nombre',
    cell: (t) => (
      <RowLink to={teacherPath(t.id)}>
        {t.user.firstName} {t.user.lastName}
      </RowLink>
    ),
  },
  {
    key: 'document',
    header: 'Documento',
    cell: (t) => `${t.user.documentType} ${t.user.documentNumber}`,
  },
  { key: 'email', header: 'Correo', cell: (t) => t.user.email ?? '—', className: 'break-all' },
  {
    key: 'profile',
    header: 'Especialidad',
    cell: (t) => t.specialty ?? t.academicDegree ?? '—',
  },
  {
    key: 'status',
    header: 'Estado',
    cell: (t) => <StatusBadge active={t.user.isActive} labels={MALE} />,
  },
];

const STUDENT_COLUMNS: Column<StudentSummary>[] = [
  {
    key: 'name',
    header: 'Nombre',
    cell: (s) => (
      <RowLink to={studentPath(s.id)}>
        {s.user.firstName} {s.user.lastName}
      </RowLink>
    ),
  },
  { key: 'code', header: 'Código', cell: (s) => s.studentCode ?? '—' },
  {
    key: 'document',
    header: 'Documento',
    // Solo de los estudiantes que quien mira puede editar.
    cell: (s) =>
      s.user.documentNumber ? `${s.user.documentType ?? ''} ${s.user.documentNumber}`.trim() : '—',
  },
  { key: 'campus', header: 'Sede', cell: (s) => s.campus?.name ?? 'Sin sede' },
  {
    key: 'status',
    header: 'Estado',
    cell: (s) => <StatusBadge active={s.user.isActive} labels={MALE} />,
  },
];

/** /people/teachers */
export function TeachersRoute() {
  return (
    <PeopleList
      slug="people.teachers"
      title="Docentes"
      description="Quienes dictan clase en la institución."
      noun="docentes"
      newLabel="Nuevo docente"
      searchPlaceholder="Nombre, documento o correo"
      columns={TEACHER_COLUMNS}
      useRows={useTeachers}
      detailPath={teacherPath}
      createDialog={(onDone) => <CreateTeacherDialog onDone={onDone} />}
    />
  );
}

export function TeacherRoute() {
  const { id = '' } = useParams();
  return <TeacherDetail id={id} />;
}

/** /people/students */
export function StudentsRoute() {
  return (
    <PeopleList
      slug="people.students"
      title="Estudiantes"
      description="Los estudiantes de la institución y su sede."
      noun="estudiantes"
      newLabel="Nuevo estudiante"
      searchPlaceholder="Nombre, documento o código"
      columns={STUDENT_COLUMNS}
      useRows={useStudents}
      detailPath={studentPath}
      createDialog={(onDone) => <CreateStudentDialog onDone={onDone} />}
    />
  );
}

export function StudentRoute() {
  const { id = '' } = useParams();
  return <StudentDetail id={id} />;
}
