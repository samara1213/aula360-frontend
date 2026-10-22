import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { errorMessage } from '@/api/errors';
import type { Teacher } from '@/api/types';
import { useSession } from '@/auth/session';
import { DetailPage } from '@/components/detail-page';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { AccountActions } from '@/features/security/account-actions';
import { PersonalDataFields } from '@/features/security/user-form';
import { personalDataSchema } from '@/features/security/user-schema';
import { isUuid } from '@/lib/ids';
import { useRefreshPeople, useTeacher, useUpdateTeacher } from './people-api';
import { TeacherProfileFields } from './person-fields';
import { changedFields, teacherFields } from './person-schema';

const MALE: readonly [string, string] = ['Activo', 'Inactivo'];

// La sede del docente es su rol: se cambia desde Seguridad → Usuarios.
const editSchema = personalDataSchema.extend(teacherFields);
type EditInput = z.input<typeof editSchema>;
type EditValues = z.output<typeof editSchema>;

/** /people/teachers/:id */
export function TeacherDetail({ id }: { id: string }) {
  const query = useTeacher(id);
  return (
    <DetailPage
      back={{ to: '/people/teachers', label: 'Docentes' }}
      validId={isUuid(id)}
      query={query}
      noun="el docente"
    >
      {(teacher) => <TeacherFile key={teacher.id} teacher={teacher} />}
    </DetailPage>
  );
}

function TeacherFile({ teacher }: { teacher: Teacher }) {
  const { user } = teacher;
  const { data: session } = useSession();
  const can = usePermissions('people.teachers');
  // Activar, desactivar y la contraseña temporal son de la cuenta: permiso de Usuarios.
  const account = usePermissions('security.users');
  const refresh = useRefreshPeople('teachers');
  const isSelf = session?.user.id === user.id;
  const name = `${user.firstName} ${user.lastName}`;

  return (
    <>
      <PageHeader
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge active={user.isActive} labels={MALE} />
            <span>Docente</span>
          </span>
        }
        actions={
          account.update &&
          !isSelf && (
            <AccountActions
              scope={{ kind: 'institution' }}
              user={{ ...user, userType: 'TEACHER' }}
              onChanged={refresh}
            />
          )
        }
      />
      {user.mustChangePassword && user.isActive && (
        <Alert>Tiene una contraseña temporal: deberá cambiarla la próxima vez que entre.</Alert>
      )}
      <Section
        title="Datos del docente"
        description="Las materias y cursos que dicta se asignan en Académico."
      >
        <TeacherForm teacher={teacher} readOnly={!can.update || isSelf} />
      </Section>
    </>
  );
}

function TeacherForm({ teacher, readOnly }: { teacher: Teacher; readOnly: boolean }) {
  const { user } = teacher;
  const update = useUpdateTeacher(teacher.id);
  const saved = {
    documentType: user.documentType,
    documentNumber: user.documentNumber,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    academicDegree: teacher.academicDegree,
    specialty: teacher.specialty,
  };
  const form = useForm<EditInput, unknown, EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      ...saved,
      email: saved.email ?? '',
      phone: saved.phone ?? '',
      academicDegree: saved.academicDegree ?? '',
      specialty: saved.specialty ?? '',
    },
    disabled: readOnly,
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    // Solo lo que cambió: no se pisa lo que otro editó a la vez.
    const changed = changedFields(values, saved);
    if (Object.keys(changed).length === 0) {
      toast.info('No hay cambios para guardar.');
      return;
    }
    update.mutate(changed, { onSuccess: () => toast.success('Datos guardados.') });
  });

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-5">
      {update.isError && <Alert variant="error">{errorMessage(update.error)}</Alert>}
      <PersonalDataFields register={form.register} errors={errors} />
      <TeacherProfileFields register={form.register} errors={errors} />
      {!readOnly && (
        <Button type="submit" className="self-start" disabled={update.isPending}>
          {update.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      )}
    </form>
  );
}
