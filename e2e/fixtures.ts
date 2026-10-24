import type { Page, Route } from '@playwright/test';

export const VIEWPORTS = [
  { name: 'celular', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'portatil', width: 1366, height: 768 },
  { name: 'escritorio', width: 1920, height: 1080 },
] as const;

export const THEMES = ['light', 'dark'] as const;

export const SESSION = {
  activeInstitutionId: '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01',
  institutions: [
    {
      id: '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01',
      name: 'Institución Educativa San José',
      roles: ['INSTITUTION_ADMIN'],
    },
    {
      id: '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e02',
      name: 'Colegio La Esperanza',
      roles: ['TEACHER'],
    },
  ],
  user: {
    id: 'user-1',
    userType: 'INSTITUTION_ADMIN',
    firstName: 'Ana María',
    lastName: 'Pérez Gómez',
    email: 'ana.perez@colegio.edu.co',
    emailVerified: true,
    pendingEmail: null,
    hasAvatar: false,
    mustChangePassword: false,
  },
};

const perms = (all: boolean) => ({ view: true, create: all, update: all, delete: all });
const leaf = (slug: string, name: string, icon: string) => ({
  id: slug,
  slug,
  name,
  icon,
  displayOrder: 0,
  permissions: perms(true),
  institutionWide: perms(true),
  children: [],
});
const group = (slug: string, name: string, icon: string, children: unknown[]) => ({
  ...leaf(slug, name, icon),
  permissions: perms(false),
  institutionWide: perms(false),
  children,
});

export const MENU = [
  group('institution', 'Institución', 'building', [
    leaf('institution.campuses', 'Sedes', 'map-pin'),
  ]),
  group('security', 'Seguridad', 'shield', [
    leaf('security.roles', 'Roles', 'key'),
    leaf('security.menu-options', 'Menús', 'list-tree'),
    leaf('security.users', 'Usuarios', 'users'),
  ]),
  group('people', 'Personas', 'contact', [
    leaf('people.teachers', 'Docentes', 'presentation'),
    leaf('people.students', 'Estudiantes', 'graduation-cap'),
  ]),
  group('academic', 'Académico', 'book-open', [
    leaf('academic.years', 'Años lectivos', 'calendar'),
    leaf('academic.periods', 'Periodos', 'calendar-range'),
    leaf('academic.grades', 'Grados', 'layers'),
    leaf('academic.courses', 'Cursos', 'school'),
    leaf('academic.subjects', 'Materias', 'book'),
    leaf('academic.performance-levels', 'Niveles de desempeño', 'award'),
    leaf('academic.teacher-assignments', 'Carga académica', 'clipboard-list'),
    leaf('academic.enrollments', 'Matrículas', 'user-plus'),
  ]),
  group('evaluations', 'Evaluaciones', 'clipboard-check', [
    leaf('evaluations.evaluations', 'Evaluaciones', 'file-check'),
    leaf('evaluations.scores', 'Notas', 'pencil'),
  ]),
  group('reports', 'Reportes', 'file-text', [
    leaf('reports.report-cards', 'Boletines', 'file-down'),
  ]),
];

/** Estudiante de la institución activa (solo sus notas). */
export const STUDENT_SESSION = {
  ...SESSION,
  institutions: [{ ...SESSION.institutions[0], roles: ['STUDENT'] }],
  user: { ...SESSION.user, userType: 'STUDENT', firstName: 'Mateo', lastName: 'Rojas Castañeda' },
};

export const SUPER_ADMIN_SESSION = {
  activeInstitutionId: null,
  institutions: [],
  user: {
    ...SESSION.user,
    id: 'admin-1',
    userType: 'SUPER_ADMIN',
    firstName: 'Fabio',
    lastName: 'Díaz',
  },
};

const stamp = { createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:00:00Z' };
const institution = (id: string, name: string, nit: string, isActive = true) => ({
  id,
  name,
  nit,
  logoPath: null,
  logoUrl: null,
  gradingScaleMin: 1,
  gradingScaleMax: 5,
  passingScore: 3,
  isActive,
  ...stamp,
});
const campus = (
  id: string,
  name: string,
  address: string | null,
  city: string | null,
  isActive = true,
) => ({
  id,
  institutionId: '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01',
  name,
  address,
  city,
  isActive,
  ...stamp,
});
const page = (data: unknown[]) => ({
  data,
  meta: { page: 1, limit: 20, total: data.length, totalPages: 1 },
});

/** Respuestas de los GET de las pantallas (la ruta exacta, sin query). */
export const INSTITUTION_ID = '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01';
export const ROLE_ID = '3f1d2c4b-5a6e-4f70-8a9b-0c1d2e3f4a5b';
export const USER_ID = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const GLOBAL_ROLE_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

const globalRole = (id: string, name: string) => ({
  id,
  institutionId: null,
  isGlobal: true,
  name,
  description: null,
  createdAt: '2026-01-15T10:00:00Z',
});
const coordination = {
  id: ROLE_ID,
  institutionId: INSTITUTION_ID,
  isGlobal: false,
  name: 'Coordinación académica',
  description: 'Coordina cursos, materias y la carga de los docentes.',
  createdAt: '2026-02-01T10:00:00Z',
};
const grant = (id: string, create: boolean, update: boolean, del: boolean) => ({
  menuOptionId: id,
  slug: id,
  name: id,
  canCreate: create,
  canUpdate: update,
  canDelete: del,
});
const assignment = (id: string, name: string, campus: string | null) => ({
  id: `a-${id}`,
  role: { id, name, isGlobal: id !== ROLE_ID },
  campus: campus ? { id: `c-${campus}`, name: campus, isActive: true } : null,
});
const user = (
  id: string,
  firstName: string,
  lastName: string,
  documentNumber: string,
  email: string | null,
  assignments: unknown[],
  isActive = true,
) => ({
  id,
  userType: 'INSTITUTION_ADMIN',
  documentType: 'CC',
  documentNumber,
  firstName,
  lastName,
  email,
  emailVerified: email !== null,
  hasPendingEmail: false,
  pendingEmail: null,
  phone: null,
  hasAvatar: false,
  isActive,
  mustChangePassword: false,
  lastLoginAt: '2026-10-18T14:30:00Z',
  assignments,
  ...stamp,
});
const USERS = [
  user(USER_ID, 'Carlos Andrés', 'Ruiz Mejía', '1020304050', 'carlos.ruiz@colegio.edu.co', [
    assignment(GLOBAL_ROLE_ID, 'INSTITUTION_ADMIN', null),
    assignment(ROLE_ID, 'Coordinación académica', 'Sede Norte — Primaria'),
  ]),
  user('8b7c6d5e-4f3a-4b2c-9d1e-0f9a8b7c6d5e', 'Luz Marina', 'Ocampo', '52987654', null, [
    assignment(ROLE_ID, 'Coordinación académica', 'Sede Principal'),
  ]),
  user(
    '9c8d7e6f-5a4b-4c3d-8e2f-1a0b9c8d7e6f',
    'Jorge',
    'Patiño Vélez',
    '79123456',
    'jpatino@colegio.edu.co',
    [],
    false,
  ),
];
const option = (
  id: string,
  name: string,
  icon: string,
  children: unknown[] = [],
  isActive = true,
) => ({
  id,
  parentId: null,
  name,
  slug: id,
  icon,
  displayOrder: 1,
  isActive,
  createdAt: '2026-01-15T10:00:00Z',
  children,
});
const MENU_TREE = [
  option('institution', 'Institución', 'building', [
    option('institution.campuses', 'Sedes', 'map-pin'),
  ]),
  option('security', 'Seguridad', 'shield', [
    option('security.roles', 'Roles', 'key'),
    option('security.menu-options', 'Menús', 'list-tree'),
    option('security.users', 'Usuarios', 'users'),
  ]),
  option('academic', 'Académico', 'book-open', [
    option('academic.courses', 'Cursos', 'school'),
    option('academic.grades', 'Grados', 'layers', [], false),
  ]),
];

export const TEACHER_ID = '2b3c4d5e-6f70-4a8b-9c0d-1e2f3a4b5c6d';
export const STUDENT_ID = '8c9d0e1f-2a3b-4c5d-8e6f-7a8b9c0d1e2f';
const profileUser = (
  id: string,
  firstName: string,
  lastName: string,
  documentType: string,
  documentNumber: string,
  email: string | null,
  isActive = true,
) => ({
  id,
  documentType,
  documentNumber,
  firstName,
  lastName,
  email,
  emailVerified: email !== null,
  phone: null,
  isActive,
  mustChangePassword: false,
  hasAvatar: false,
});
const teacher = (
  id: string,
  user: ReturnType<typeof profileUser>,
  academicDegree: string | null,
  specialty: string | null,
) => ({ id, institutionId: INSTITUTION_ID, academicDegree, specialty, user, ...stamp });
const TEACHERS = [
  teacher(
    TEACHER_ID,
    profileUser(
      't-1',
      'Laura Cristina',
      'Gómez Restrepo',
      'CC',
      '52123456',
      'lgomez@colegio.edu.co',
    ),
    'Licenciada en Matemáticas',
    'Álgebra y geometría',
  ),
  teacher(
    '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
    profileUser('t-2', 'Pedro', 'Vargas', 'CC', '79111222', null),
    null,
    'Ciencias naturales',
  ),
  teacher(
    '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f7a',
    profileUser('t-3', 'Ana Milena', 'Torres', 'CE', '998877', 'atorres@colegio.edu.co', false),
    'Magíster en Educación',
    null,
  ),
];
const student = (
  id: string,
  user: ReturnType<typeof profileUser>,
  studentCode: string | null,
  campusName: string | null,
) => ({
  id,
  institutionId: INSTITUTION_ID,
  studentCode,
  campus: campusName ? { id: 'c-2', name: campusName, isActive: true } : null,
  user,
  ...stamp,
});
const STUDENTS = [
  student(
    STUDENT_ID,
    profileUser('s-1', 'Mateo', 'Rojas Castañeda', 'TI', '1012345678', null),
    '2026-0153',
    'Sede Norte — Primaria',
  ),
  student(
    '9d0e1f2a-3b4c-4d5e-9f6a-7b8c9d0e1f2b',
    profileUser('s-2', 'Valentina', 'Ospina', 'RC', '1098765432', null),
    null,
    null,
  ),
];

export const YEAR_ID = '6e7f8a9b-0c1d-4e2f-8a3b-4c5d6e7f8a9b';
const academicYear = (id: string, year: number, isActive = true) => ({
  id,
  institutionId: INSTITUTION_ID,
  year,
  isActive,
  createdAt: stamp.createdAt,
});
const YEARS = [
  academicYear('7f8a9b0c-1d2e-4f3a-9b4c-5d6e7f8a9b0c', 2027, false),
  academicYear(YEAR_ID, 2026),
  academicYear('8a9b0c1d-2e3f-4a4b-8c5d-6e7f8a9b0c1d', 2025, false),
];
const academicPeriod = (id: string, name: string, startDate: string, endDate: string) => ({
  id,
  academicYearId: YEAR_ID,
  name,
  startDate,
  endDate,
  createdAt: stamp.createdAt,
});
const catalogItem = (id: string, name: string) => ({
  id,
  institutionId: INSTITUTION_ID,
  name,
  createdAt: stamp.createdAt,
});

export const COURSE_ID = '9b0c1d2e-3f4a-4b5c-8d6e-7f8a9b0c1d2f';
const year2026 = { id: YEAR_ID, year: 2026, isActive: true };
const sede = (id: string, name: string) => ({ id, name, isActive: true });
const academicCourse = (
  id: string,
  name: string,
  grade: string,
  campusId: string,
  campusName: string,
) => ({
  id,
  name,
  grade: { id: `g-${grade}`, name: grade },
  campus: sede(campusId, campusName),
  academicYear: year2026,
  createdAt: stamp.createdAt,
});
const COURSES = [
  academicCourse(COURSE_ID, '601', 'Sexto', 'c-1', 'Sede Principal'),
  academicCourse('ac0d1e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f', '602', 'Sexto', 'c-1', 'Sede Principal'),
  academicCourse(
    'bd1e2f3a-4b5c-4d6e-8f7a-8b9c0d1e2f3a',
    'Transición A',
    'Transición',
    'c-2',
    'Sede Norte — Primaria',
  ),
];
const assignmentRow = (
  id: string,
  subject: string,
  firstName: string,
  lastName: string,
  isActive = true,
) => ({
  id,
  isActive,
  course: COURSES[0],
  subject: { id: `s-${subject}`, name: subject },
  teacher: { id: `t-${lastName}`, userId: `u-${lastName}`, firstName, lastName },
  createdAt: '2026-01-26T10:00:00Z',
  deactivatedAt: isActive ? null : '2026-03-15T10:00:00Z',
});
const ASSIGNMENTS = [
  assignmentRow('as-1', 'Matemáticas', 'Laura Cristina', 'Gómez Restrepo'),
  assignmentRow('as-2', 'Ciencias naturales y educación ambiental', 'Pedro', 'Vargas'),
  assignmentRow('as-3', 'Lengua castellana', 'Ana Milena', 'Torres'),
];
const enrollmentRow = (
  id: string,
  studentId: string,
  firstName: string,
  lastName: string,
  code: string | null,
  status: string,
) => ({
  id,
  status,
  enrollmentDate: '2026-01-20T10:00:00Z',
  student: { id: studentId, studentCode: code, firstName, lastName },
  course: {
    id: COURSE_ID,
    name: '601',
    grade: { id: 'g-Sexto', name: 'Sexto' },
    campus: sede('c-1', 'Sede Principal'),
  },
  academicYear: year2026,
});
const ENROLLMENTS = [
  enrollmentRow('e-1', STUDENT_ID, 'Mateo', 'Rojas Castañeda', '2026-0153', 'ENROLLED'),
  enrollmentRow(
    'e-2',
    '9d0e1f2a-3b4c-4d5e-9f6a-7b8c9d0e1f2b',
    'Valentina',
    'Ospina',
    null,
    'SUSPENDED',
  ),
  enrollmentRow(
    'e-3',
    'f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b',
    'Juan José',
    'Martínez Pérez',
    '2026-0201',
    'DROPPED',
  ),
  enrollmentRow(
    'e-4',
    'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6e',
    'Sara',
    'López',
    '2025-0099',
    'GRADUATED',
  ),
];

// Evaluaciones y notas (ids UUID: los filtros de la URL solo aceptan UUID).
export const ASSIGNMENT_ID = 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f';
export const EVALUATION_ID = 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a';
const MY_ASSIGNMENTS = [
  { ...assignmentRow(ASSIGNMENT_ID, 'Matemáticas', 'Laura Cristina', 'Gómez Restrepo') },
  {
    ...assignmentRow(
      'e3f4a5b6-c7d8-4e9f-8a0b-2c3d4e5f6a7b',
      'Ciencias naturales y educación ambiental',
      'Laura Cristina',
      'Gómez Restrepo',
    ),
    course: COURSES[2],
  },
];
const MY_PERIODS = [
  academicPeriod(
    'f4a5b6c7-d8e9-4f0a-9b1c-3d4e5f6a7b8c',
    'Primer periodo',
    '2026-01-26',
    '2026-04-03',
  ),
  academicPeriod(
    'a5b6c7d8-e9f0-4a1b-8c2d-4e5f6a7b8c9d',
    'Segundo periodo',
    '2026-04-13',
    '2099-12-31',
  ),
];
const evaluationRow = (id: string, title: string, percentage: number, date: string) => ({
  id,
  title,
  percentage,
  evaluationDate: date,
  period: MY_PERIODS[1],
  teacherAssignment: {
    id: ASSIGNMENT_ID,
    isActive: true,
    course: { id: COURSE_ID, name: '601' },
    subject: MY_ASSIGNMENTS[0]?.subject,
    teacher: MY_ASSIGNMENTS[0]?.teacher,
  },
  createdAt: stamp.createdAt,
});
const EVALUATIONS = [
  evaluationRow(EVALUATION_ID, 'Taller de fracciones', 25, '2026-04-20'),
  evaluationRow(
    'b6c7d8e9-f0a1-4b2c-9d3e-5f6a7b8c9d0e',
    'Evaluación escrita del segundo periodo sobre proporcionalidad',
    35,
    '2026-05-15',
  ),
  evaluationRow('c7d8e9f0-a1b2-4c3d-8e4f-6a7b8c9d0e1f', 'Exposición', 12.5, '2026-06-02'),
];
const scoreStudent = (
  studentId: string,
  firstName: string,
  lastName: string,
  score: number | null,
  enrollmentStatus: string | null = 'ENROLLED',
) => ({
  studentId,
  firstName,
  lastName,
  enrollmentStatus,
  score,
  status: score === null ? 'PENDING' : 'GRADED',
  updatedAt: score === null ? null : stamp.createdAt,
});
const SCORE_SHEET = {
  evaluation: EVALUATIONS[0],
  scale: { min: 1, max: 5, passingScore: 3 },
  students: [
    scoreStudent(STUDENT_ID, 'Mateo', 'Rojas Castañeda', 4.5),
    scoreStudent('d8e9f0a1-b2c3-4d4e-9f5a-7b8c9d0e1f2a', 'María José', 'Fernández de la Hoz', null),
    scoreStudent('e9f0a1b2-c3d4-4e5f-8a6b-8c9d0e1f2a3b', 'Valentina', 'Ospina', 2.8, 'SUSPENDED'),
    scoreStudent(
      'f0a1b2c3-d4e5-4f6a-9b7c-9d0e1f2a3b4c',
      'Juan José',
      'Martínez Pérez',
      3,
      'DROPPED',
    ),
    scoreStudent('a1b2c3d4-e5f6-4a7b-8c8d-0e1f2a3b4c5d', 'Sara', 'López', null),
  ],
  canAdminister: true,
  lockedReason: null,
};

// Cuadro de notas: un curso con varias materias (más ancho que un celular).
const SUBJECT_NAMES = [
  'Matemáticas',
  'Lengua castellana',
  'Ciencias naturales y educación ambiental',
  'Ciencias sociales',
  'Inglés',
  'Educación física',
  'Educación artística',
  'Tecnología e informática',
];
const SUBJECTS = SUBJECT_NAMES.map((name, i) => ({
  id: `b${String(i)}c7d8e9-f0a1-4b2c-9d3e-5f6a7b8c9d0e`,
  name,
}));
const periodGrade = (final: number | null, scored = 3, count = 3, accumulated = final ?? 2.1) => ({
  evaluationCount: count,
  scoredCount: scored,
  allocatedPercentage: count === 0 ? 0 : 100,
  accumulated: count === 0 ? 0 : accumulated,
  final,
  passed: final === null ? null : final >= 3,
});
const gradebookStudent = (
  id: string,
  firstName: string,
  lastName: string,
  status: string,
  finals: (number | null)[],
) => {
  const values = finals.filter((v): v is number => v !== null);
  return {
    student: { id, firstName, lastName },
    enrollmentStatus: status,
    subjects: SUBJECTS.map((subject, i) => ({
      subjectId: subject.id,
      ...(i >= finals.length ? periodGrade(null, 0, 0) : periodGrade(finals[i] ?? null, 2)),
    })),
    average: values.length
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
      : null,
  };
};
const COURSE_GRADEBOOK = {
  course: { id: COURSE_ID, name: '601' },
  period: MY_PERIODS[1],
  scale: { min: 1, max: 5, passingScore: 3 },
  subjects: SUBJECTS,
  students: [
    gradebookStudent(
      STUDENT_ID,
      'Mateo',
      'Rojas Castañeda',
      'ENROLLED',
      [4.5, 3.8, 4.1, 2.7, 4.9, 5, 3.2, 4],
    ),
    gradebookStudent(
      'd8e9f0a1-b2c3-4d4e-9f5a-7b8c9d0e1f2a',
      'María José',
      'Fernández de la Hoz',
      'ENROLLED',
      [3.1, null, 3.6, 3, 2.4, 4.4, 4, 3.9],
    ),
    gradebookStudent('e9f0a1b2-c3d4-4e5f-8a6b-8c9d0e1f2a3b', 'Valentina', 'Ospina', 'SUSPENDED', [
      null,
      null,
      2.2,
      null,
      3.5,
    ]),
  ],
};
const STUDENT_GRADEBOOK = {
  student: { id: STUDENT_ID, firstName: 'Mateo', lastName: 'Rojas Castañeda' },
  enrollmentStatus: 'ENROLLED',
  course: { id: COURSE_ID, name: '601' },
  academicYear: year2026,
  scale: { min: 1, max: 5, passingScore: 3 },
  periods: MY_PERIODS.map(({ id, name, startDate, endDate }) => ({ id, name, startDate, endDate })),
  subjects: SUBJECTS.slice(0, 5).map((subject, i) => ({
    ...subject,
    periods: [
      {
        periodId: MY_PERIODS[0]?.id,
        ...periodGrade([4.2, 2.8, 3.9, 4.6, 3.3][i] ?? null),
        evaluations: [
          {
            id: `e1-${String(i)}`,
            title: 'Taller de fracciones',
            percentage: 40,
            evaluationDate: '2026-02-20',
            score: 4,
          },
          {
            id: `e2-${String(i)}`,
            title: 'Evaluación escrita del primer periodo',
            percentage: 60,
            evaluationDate: '2026-03-25',
            score: 4.3,
          },
        ],
      },
      {
        periodId: MY_PERIODS[1]?.id,
        ...periodGrade(null, 1, 3, 1.6),
        evaluations: [
          {
            id: `e3-${String(i)}`,
            title: 'Exposición',
            percentage: 30,
            evaluationDate: '2026-05-04',
            score: 4.5,
          },
          {
            id: `e4-${String(i)}`,
            title: 'Quiz',
            percentage: 30,
            evaluationDate: '2026-05-20',
            score: null,
          },
        ],
      },
    ],
    yearFinal: null,
    yearPassed: null,
  })),
  periodAverages: [
    { periodId: MY_PERIODS[0]?.id, average: 3.76 },
    { periodId: MY_PERIODS[1]?.id, average: null },
  ],
  yearAverage: null,
};

// Boletines.
const reportCard = (
  id: string,
  studentId: string,
  firstName: string,
  lastName: string,
  finalAverage: number,
  outdated = false,
) => ({
  id,
  student: { id: studentId, firstName, lastName },
  course: { id: COURSE_ID, name: '601' },
  period: { id: MY_PERIODS[0]?.id, name: 'Primer periodo' },
  finalAverage,
  templateId: null,
  outdated,
  outdatedAt: outdated ? '2026-04-20T10:00:00Z' : null,
  generatedBy: 'user-1',
  generatedAt: '2026-04-10T10:00:00Z',
});
const REPORT_CARDS = [
  reportCard('a7b8c9d0-e1f2-4a3b-8c4d-5e6f7a8b9c0d', STUDENT_ID, 'Mateo', 'Rojas Castañeda', 4.36),
  reportCard(
    'b8c9d0e1-f2a3-4b4c-9d5e-6f7a8b9c0d1e',
    'd8e9f0a1-b2c3-4d4e-9f5a-7b8c9d0e1f2a',
    'María José',
    'Fernández de la Hoz',
    3.48,
    true,
  ),
  reportCard(
    'c9d0e1f2-a3b4-4c5d-8e6f-7a8b9c0d1e2f',
    'e9f0a1b2-c3d4-4e5f-8a6b-8c9d0e1f2a3b',
    'Valentina',
    'Ospina',
    2.91,
  ),
];
const MY_REPORT_CARDS = [
  {
    id: REPORT_CARDS[0]?.id,
    course: { id: COURSE_ID, name: '601' },
    period: { id: MY_PERIODS[0]?.id, name: 'Primer periodo' },
    finalAverage: 4.36,
    outdated: false,
    generatedAt: '2026-04-10T10:00:00Z',
  },
  {
    id: 'd0e1f2a3-b4c5-4d6e-9f7a-8b9c0d1e2f3a',
    course: { id: COURSE_ID, name: '601' },
    period: { id: MY_PERIODS[1]?.id, name: 'Segundo periodo' },
    finalAverage: 3.9,
    outdated: true,
    generatedAt: '2026-06-25T10:00:00Z',
  },
];

/** Plantillas del boletín de la institución (SUPER_ADMIN). */
const REPORT_TEMPLATES = [
  {
    id: 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b',
    name: 'Boletín institucional 2026 con escudo y firmas de rectoría',
    description: 'Encabezado a color, tabla por áreas y espacio para las firmas.',
    isActive: true,
    contentSha256: 'a'.repeat(64),
    createdBy: null,
    createdAt: '2026-10-20T15:00:00Z',
  },
  {
    id: 'f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c',
    name: 'Versión sobria',
    description: null,
    isActive: false,
    contentSha256: 'b'.repeat(64),
    createdBy: null,
    createdAt: '2026-10-18T15:00:00Z',
  },
];

const GET_DATA: Record<string, unknown> = {
  [`/api/institutions/${INSTITUTION_ID}/report-card-templates`]: REPORT_TEMPLATES,
  '/api/report-cards': page(REPORT_CARDS),
  '/api/report-cards/mine': MY_REPORT_CARDS,
  [`/api/gradebook/courses/${COURSE_ID}`]: COURSE_GRADEBOOK,
  '/api/gradebook/mine': STUDENT_GRADEBOOK,
  [`/api/gradebook/students/${STUDENT_ID}`]: STUDENT_GRADEBOOK,
  '/api/teacher-assignments/mine': MY_ASSIGNMENTS,
  '/api/teacher-assignments/mine/periods': MY_PERIODS,
  '/api/evaluations': { ...page(EVALUATIONS), canAdminister: true },
  [`/api/evaluations/${EVALUATION_ID}/scores`]: SCORE_SHEET,
  '/api/courses': page(COURSES),
  [`/api/courses/${COURSE_ID}`]: COURSES[0],
  '/api/teacher-assignments': page(ASSIGNMENTS),
  '/api/enrollments': page(ENROLLMENTS),
  '/api/academic-years': page(YEARS),
  [`/api/academic-years/${YEAR_ID}`]: YEARS[1],
  [`/api/academic-years/${YEAR_ID}/periods`]: [
    academicPeriod('p-1', 'Primer periodo', '2026-01-26', '2026-04-03'),
    academicPeriod('p-2', 'Segundo periodo', '2026-04-13', '2026-06-19'),
    academicPeriod('p-3', 'Tercer periodo', '2026-07-06', '2026-09-11'),
    academicPeriod('p-4', 'Cuarto periodo (recuperaciones y cierre)', '2026-09-14', '2026-11-27'),
  ],
  '/api/grades': page([
    catalogItem('g-1', 'Transición'),
    catalogItem('g-2', 'Primero'),
    catalogItem('g-3', 'Sexto'),
    catalogItem('g-4', 'Undécimo'),
  ]),
  '/api/subjects': page([
    catalogItem('s-1', 'Matemáticas'),
    catalogItem('s-2', 'Ciencias naturales y educación ambiental'),
    catalogItem('s-3', 'Lengua castellana'),
  ]),
  '/api/performance-levels': {
    scale: { min: 1, max: 5, passingScore: 3 },
    levels: [
      { id: 'l-1', name: 'Bajo', minScore: 1, maxScore: 2.99, displayOrder: 1 },
      { id: 'l-2', name: 'Básico', minScore: 3, maxScore: 3.99, displayOrder: 2 },
      { id: 'l-3', name: 'Alto', minScore: 4, maxScore: 4.59, displayOrder: 3 },
      { id: 'l-4', name: 'Superior', minScore: 4.6, maxScore: 5, displayOrder: 4 },
    ],
  },
  '/api/teachers': page(TEACHERS),
  [`/api/teachers/${TEACHER_ID}`]: TEACHERS[0],
  '/api/students': page(STUDENTS),
  [`/api/students/${STUDENT_ID}`]: {
    ...STUDENTS[0],
    guardianName: 'Marta Castañeda',
    guardianPhone: '+57 300 000 0001',
    guardianEmail: 'marta.castaneda@correo.com',
    bloodType: 'O+',
  },
  [`/api/institutions/${INSTITUTION_ID}/campuses`]: page([
    campus('c-1', 'Sede Principal', 'Calle 10 # 5-20', 'Bogotá'),
    campus('c-2', 'Sede Norte — Primaria', 'Carrera 45 # 170-32', 'Bogotá'),
  ]),
  '/api/roles': page([
    globalRole(GLOBAL_ROLE_ID, 'INSTITUTION_ADMIN'),
    globalRole('1b0a9c8d-7e6f-4a5b-8c4d-3e2f1a0b9c8d', 'TEACHER'),
    coordination,
  ]),
  [`/api/roles/${ROLE_ID}`]: {
    ...coordination,
    permissions: [
      grant('institution', false, false, false),
      grant('institution.campuses', false, false, false),
      grant('security', false, false, false),
      grant('security.users', true, true, false),
    ],
  },
  '/api/users': page(USERS),
  [`/api/users/${USER_ID}`]: USERS[0],
  '/api/menu-options': MENU_TREE,
  '/api/global-roles': page([
    globalRole(GLOBAL_ROLE_ID, 'INSTITUTION_ADMIN'),
    globalRole('1b0a9c8d-7e6f-4a5b-8c4d-3e2f1a0b9c8d', 'TEACHER'),
  ]),
  [`/api/institutions/${INSTITUTION_ID}/users`]: page(USERS.slice(0, 2)),
  [`/api/institutions/${INSTITUTION_ID}/role-assignments`]: page([]),
  '/api/institutions/current': institution(
    '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01',
    'Institución Educativa San José',
    '900123456-7',
  ),
  '/api/campuses': page([
    campus('c-1', 'Sede Principal', 'Calle 10 # 5-20', 'Bogotá'),
    campus('c-2', 'Sede Norte — Primaria', 'Carrera 45 # 170-32, barrio San Antonio', 'Bogotá'),
    campus('c-3', 'Sede Rural La Vega', null, 'La Vega, Cundinamarca', false),
  ]),
  '/api/institutions': page([
    institution(
      '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01',
      'Institución Educativa San José',
      '900123456-7',
    ),
    institution('5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e02', 'Colegio La Esperanza', '800765432-1'),
    institution(
      '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e03',
      'Liceo Antiguo del Valle',
      '860001234-5',
      false,
    ),
  ]),
  '/api/institutions/5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01': institution(
    '5c0e7a1e-2b1f-4c3d-8e9f-0a1b2c3d4e01',
    'Institución Educativa San José',
    '900123456-7',
  ),
};

/** Simula la API: con `session` null no hay sesión (401). */
export async function mockApi(page: Page, session: unknown) {
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const unauthorized = { statusCode: 401, message: 'No autorizado', error: 'UNAUTHORIZED' };

  // Solo la API (no los módulos de Vite en /src/api/...).
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me')
        return session ? json(route, session) : json(route, unauthorized, 401);
      if (path === '/api/auth/refresh-token') return json(route, unauthorized, 401);
      if (path === '/api/menu-options/my-menu') return json(route, MENU);
      if (route.request().method() === 'GET' && Object.hasOwn(GET_DATA, path))
        return json(route, GET_DATA[path]);
      return json(route, { statusCode: 404, message: 'No encontrado', error: 'NOT_FOUND' }, 404);
    },
  );
}

export async function setTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript((value) => {
    localStorage.setItem('aula360.theme', value);
  }, theme);
}
