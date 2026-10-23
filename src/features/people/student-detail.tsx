import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ApiError, errorMessage } from '@/api/errors';
import type { Student, UpdateStudentBody } from '@/api/types';
import { useSession } from '@/auth/session';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DetailPage } from '@/components/detail-page';
import { Section } from '@/components/section';
import { StudentEnrollments } from '@/features/academic/student-enrollments';
import { StudentGradesSection } from '@/features/evaluations/student-grades-section';
import { StudentReportCardsSection } from '@/features/reports/student-report-cards';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { AccountActions } from '@/features/security/account-actions';
import { PersonalDataFields } from '@/features/security/user-form';
import { isUuid } from '@/lib/ids';
import { useCampusChoices } from './campus-choices';
import { useForgetPerson, useRefreshPeople, useStudent, useUpdateStudent } from './people-api';
import { CampusSelect, StudentProfileFields } from './person-fields';
import {
  changedFields,
  studentSchema,
  type StudentInput,
  type StudentValues,
} from './person-schema';

const MALE: readonly [string, string] = ['Activo', 'Inactivo'];

/** /people/students/:id */
export function StudentDetail({ id }: { id: string }) {
  const query = useStudent(id);
  return (
    <DetailPage
      back={{ to: '/people/students', label: 'Estudiantes' }}
      validId={isUuid(id)}
      query={query}
      noun="el estudiante"
    >
      {(student) => <StudentFile key={student.id} student={student} />}
    </DetailPage>
  );
}

function StudentFile({ student }: { student: Student }) {
  const { user } = student;
  const { data: session } = useSession();
  // Activar, desactivar y la contraseña temporal son de la cuenta: permiso de Usuarios.
  const account = usePermissions('security.users');
  const refresh = useRefreshPeople('students');
  const isSelf = session?.user.id === user.id;
  const name = `${user.firstName} ${user.lastName}`;
  // El backend solo entrega documento, contacto y acudiente a quien puede editarlo.
  const full = user.documentNumber !== undefined;

  return (
    <>
      <PageHeader
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge active={user.isActive} labels={MALE} />
            <span>Estudiante</span>
            {student.studentCode && (
              <>
                <span aria-hidden="true">·</span>
                <span>Código {student.studentCode}</span>
              </>
            )}
          </span>
        }
        actions={
          full &&
          account.update &&
          !isSelf && (
            <AccountActions
              scope={{ kind: 'institution' }}
              user={{ ...user, userType: 'STUDENT' }}
              onChanged={refresh}
            />
          )
        }
      />
      {user.mustChangePassword && user.isActive && (
        <Alert>Tiene una contraseña temporal: deberá cambiarla la próxima vez que entre.</Alert>
      )}
      {full && !isSelf ? (
        <Section
          title="Datos del estudiante"
          description="La matrícula en un curso se hace en Académico."
        >
          <StudentForm student={student} />
        </Section>
      ) : (
        <Section title="Datos del estudiante">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Sede</dt>
              <dd className="font-bold">{student.campus?.name ?? 'Sin sede'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Código</dt>
              <dd className="font-bold">{student.studentCode ?? '—'}</dd>
            </div>
          </dl>
          <Alert>
            Solo ves sus datos básicos: el documento, el contacto y el acudiente los ve quien puede
            editar a este estudiante.
          </Alert>
        </Section>
      )}
      <StudentEnrollments studentId={student.id} />
      <StudentGradesSection studentId={student.id} />
      <StudentReportCardsSection studentId={student.id} />
    </>
  );
}

/**
 * Espera las sedes: un <select> montado antes que sus opciones pierde el valor
 * guardado y el formulario lo enviaría vacío.
 */
function StudentForm({ student }: { student: Student }) {
  const choices = useCampusChoices('people.students');
  if (choices.isPending) return <Skeleton className="h-96 rounded-2xl" />;
  // La sede actual siempre está entre las opciones, aunque esté inactiva.
  const current = student.campus;
  const campuses =
    current && !choices.options.some((c) => c.value === current.id)
      ? {
          ...choices,
          options: [
            ...choices.options,
            {
              value: current.id,
              label: current.isActive ? current.name : `${current.name} (inactiva)`,
            },
          ],
        }
      : choices;
  return <StudentFormFields student={student} campuses={campuses} />;
}

function StudentFormFields({
  student,
  campuses,
}: {
  student: Student;
  campuses: ReturnType<typeof useCampusChoices>;
}) {
  const { user } = student;
  const can = usePermissions('people.students');
  const update = useUpdateStudent(student.id);
  const forget = useForgetPerson('students');
  const navigate = useNavigate();
  const [pending, setPending] = useState<UpdateStudentBody | null>(null);
  const readOnly = !can.update;
  const saved = {
    documentType: user.documentType,
    documentNumber: user.documentNumber,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    studentCode: student.studentCode,
    guardianName: student.guardianName,
    guardianPhone: student.guardianPhone,
    guardianEmail: student.guardianEmail,
    bloodType: student.bloodType,
    campusId: student.campus?.id ?? null,
  };
  const form = useForm<StudentInput, unknown, StudentValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      documentType: saved.documentType ?? 'TI',
      documentNumber: saved.documentNumber ?? '',
      firstName: saved.firstName,
      lastName: saved.lastName,
      email: saved.email ?? '',
      phone: saved.phone ?? '',
      studentCode: saved.studentCode ?? '',
      guardianName: saved.guardianName ?? '',
      guardianPhone: saved.guardianPhone ?? '',
      guardianEmail: saved.guardianEmail ?? '',
      bloodType: (saved.bloodType ?? '') as StudentInput['bloodType'],
      campusId: saved.campusId ?? '',
    },
    disabled: readOnly,
  });
  const { errors } = form.formState;

  const save = (body: UpdateStudentBody) => {
    update.mutate(body, {
      onSuccess: () => {
        toast.success('Datos guardados.');
        setPending(null);
      },
      onError: (error) => {
        setPending(null);
        // 404 tras guardar: ya no puede verlo (p. ej. lo movió a una sede que no
        // administra). Su ficha completa no se queda en pantalla ni en la caché.
        if (error instanceof ApiError && error.status === 404) {
          forget(student.id);
          toast.info(
            'Ya no puedes ver a este estudiante: si cambiaste su sede, quedó en una que no administras.',
          );
          void navigate('/people/students');
        }
      },
    });
  };

  const onSubmit = form.handleSubmit((values) => {
    // Solo lo que cambió: no se pisa lo que otro editó a la vez.
    const changed = changedFields({ ...values, campusId: values.campusId || null }, saved);
    if (Object.keys(changed).length === 0) {
      toast.info('No hay cambios para guardar.');
      return;
    }
    // Cambiar de sede mueve también su rol de estudiante: se confirma antes.
    if ('campusId' in changed) setPending(changed);
    else save(changed);
  });

  const newCampus = campuses.options.find((c) => c.value === pending?.campusId)?.label;

  return (
    <>
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
        {update.isError && <Alert variant="error">{errorMessage(update.error)}</Alert>}
        <PersonalDataFields register={form.register} errors={errors} />
        <CampusSelect
          {...form.register('campusId')}
          choices={campuses}
          noneLabel="Sin sede"
          error={errors.campusId?.message}
          hint="Cambiarla mueve también su rol de estudiante a la sede nueva."
        />
        <StudentProfileFields register={form.register} errors={errors} />
        {!readOnly && (
          <Button type="submit" className="self-start" disabled={update.isPending}>
            {update.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        )}
      </form>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={`¿Cambiar a ${user.firstName} de sede?`}
        description={
          newCampus
            ? `Pasa a «${newCampus}»: su rol de estudiante se mueve a esa sede y deja de verlo quien solo administra la sede anterior.`
            : 'Queda sin sede: su rol de estudiante pasa a toda la institución.'
        }
        confirmLabel="Cambiar de sede"
        pendingLabel="Guardando…"
        pending={update.isPending}
        onConfirm={() => {
          if (pending) save(pending);
        }}
      />
    </>
  );
}
