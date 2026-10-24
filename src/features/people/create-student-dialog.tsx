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
import { useCreateStudent, useInvite } from './people-api';
import { isExistingAccount } from './existing-account';
import { LinkExistingPanel } from './link-existing';
import { CampusSelect, StudentProfileFields } from './person-fields';
import {
  emptyStudent,
  studentSchema,
  type StudentInput,
  type StudentValues,
} from './person-schema';

const FORM_ID = 'create-student-form';

/**
 * Nuevo estudiante: crea su usuario, su rol de estudiante en la sede y su
 * ficha. Al terminar muestra la contraseña temporal (una sola vez). Va dentro
 * de un <Dialog>.
 */
export function CreateStudentDialog({ onDone }: { onDone: (createdId?: string) => void }) {
  const create = useCreateStudent();
  const invite = useInvite('students');
  const campuses = useCampusChoices('people.students');
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const form = useForm<StudentInput, unknown, StudentValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: emptyStudent,
  });
  const { errors } = form.formState;

  if (created) {
    return (
      <CreatedAccountContent
        title="Estudiante creado"
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
        onSuccess: (student) => {
          const name = `${student.user.firstName} ${student.user.lastName}`;
          toast.success(`Estudiante ${name} creado.`);
          setCreated({
            id: student.id,
            name,
            password: student.temporaryPassword,
            emailed: typeof student.user.email === 'string',
          });
        },
      },
    );
  });

  return (
    <DialogContent
      title="Nuevo estudiante"
      description="Recibe una contraseña temporal que debe cambiar al entrar. La matrícula en un curso se hace después."
      className="sm:w-[min(92vw,680px)]"
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={FORM_ID} disabled={create.isPending || campuses.isPending}>
            {create.isPending ? 'Creando…' : 'Crear estudiante'}
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
        {isExistingAccount(create.error) && (
          <LinkExistingPanel
            kind="students"
            readDocument={() => ({
              documentType: form.getValues('documentType'),
              documentNumber: form.getValues('documentNumber').trim(),
            })}
            inviting={{ isPending: invite.isPending, error: invite.error }}
            onInvite={(document, displayName) => {
              const campusId = form.getValues('campusId');
              if (!campuses.allowNone && !campusId) {
                form.setError('campusId', {
                  message: 'Elige la sede: solo puedes invitar a tus sedes.',
                });
                return;
              }
              invite.mutate(
                { ...document, campusId: campusId || null },
                {
                  onSuccess: () => {
                    toast.success(
                      `Invitación enviada a ${displayName}: al entrar a Aula360 la acepta o la rechaza.`,
                    );
                    onDone();
                  },
                },
              );
            }}
          />
        )}
        {campuses.isError && (
          <Alert variant="error">No pudimos cargar las sedes. Cierra y vuelve a intentarlo.</Alert>
        )}
        <PersonalDataFields register={form.register} errors={errors} />
        <CampusSelect
          {...form.register('campusId')}
          choices={campuses}
          noneLabel="Sin sede"
          error={errors.campusId?.message}
        />
        <StudentProfileFields register={form.register} errors={errors} />
      </form>
    </DialogContent>
  );
}
