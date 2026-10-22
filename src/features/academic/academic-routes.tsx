import { useParams } from 'react-router';
import { AssignmentsPage } from './assignments';
import { CatalogPage } from './catalog';
import { CourseDetail, CoursesPage } from './courses';
import { EnrollmentsPage } from './enrollments';
import { PerformanceLevelsPage } from './performance-levels';
import { PeriodsPage } from './periods';
import { YearDetail, YearsPage } from './years';

// Pantallas de Académico tal como las monta el router (un solo archivo diferido).

export function YearsRoute() {
  return <YearsPage />;
}

export function YearRoute() {
  const { id = '' } = useParams();
  return <YearDetail id={id} />;
}

export function PeriodsRoute() {
  return <PeriodsPage />;
}

export function GradesRoute() {
  return <CatalogPage key="grades" kind="grades" />;
}

export function SubjectsRoute() {
  return <CatalogPage key="subjects" kind="subjects" />;
}

export function PerformanceLevelsRoute() {
  return <PerformanceLevelsPage />;
}

export function CoursesRoute() {
  return <CoursesPage />;
}

export function CourseRoute() {
  const { id = '' } = useParams();
  return <CourseDetail id={id} />;
}

export function AssignmentsRoute() {
  return <AssignmentsPage />;
}

export function EnrollmentsRoute() {
  return <EnrollmentsPage />;
}
