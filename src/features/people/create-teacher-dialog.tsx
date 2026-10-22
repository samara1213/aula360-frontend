import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogContent } from '@/components/ui/dialog';
import { CreatedAccountContent, type CreatedAccount } from '@/features/security/temporary-password';
import { PersonalDataFields } from '@/features/security/user-form';
import { useCampusChoices } from './campus-choices';
import { useCreateTeacher } from './people-api';
import { CampusSelect, TeacherProfileFields } from './person-fields';
import {
  emptyTeacher,
  teacherSchema,
  type TeacherInput,
  type TeacherValues,
} from './person-schema';

const FORM_ID = 'create-teacher-form';

/**
 * Nuevo docente: crea su usuario, su rol de docente y su ficha. Al terminar
 * muestra la contraseña temporal (una sola vez). Va dentro de un <Dialog>.
 */
export function CreateTeacherDialog({ onDone }: { onDone: (createdId?: string) => void }) {
  const create = useCreateTeacher();
  const campuses = useCampusChoices('people.teachers');
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const form = useForm<TeacherInput, unknown, TeacherValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: emptyTeacher,
  });
  const { errors } = form.formState;

  if (created) {
    return (
      <CreatedAccountContent
        title="Docente creado"
        created={created}
        discard={() => {
          create.reset();
        }}
        onDone={() => {
          onDone(created.id);
        }}
      />
    );
  }

  const onSubmit = form.handleSubmit((values) => {
    if (!campuses.allowNone && !values.campusId) {
      form.setError('campusId', { message: 'Elige la sede: solo puedes crear en tus sedes.' });
      return;
    }
    create.mutate(
      { ...values, campusId: values.campusId || null },
      {
        onSuccess: (teacher) => {
          const name = `${teacher.user.firstName} ${teacher.user.lastName}`;
          toast.success(`Docente ${name} creado.`);
          setCreated({
            id: teacher.id,
            name,
            password: teacher.temporaryPassword,
            emailed: teacher.user.email !== null,
          });
        },
      },
    );
  });

  return (
    <DialogContent
      title="Nuevo docente"
      description="Recibe una contraseña temporal que debe cambiar al entrar."
      className="sm:w-[min(92vw,680px)]"
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={FORM_ID} disabled={create.isPending || campuses.isPending}>
            {create.isPending ? 'Creando…' : 'Crear docente'}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="flex flex-col gap-5"
      >
        {create.isError && <Alert variant="error">{errorMessage(create.error)}</Alert>}
        {campuses.isError && (
          <Alert variant="error">No pudimos cargar las sedes. Cierra y vuelve a intentarlo.</Alert>
        )}
        <PersonalDataFields register={form.register} errors={errors} />
        <TeacherProfileFields register={form.register} errors={errors} />
        <CampusSelect
          {...form.register('campusId')}
          choices={campuses}
          noneLabel="Toda la institución"
          error={errors.campusId?.message}
          hint="Dónde trabaja. Las materias y cursos se le asignan después."
        />
      </form>
    </DialogContent>
  );
}
