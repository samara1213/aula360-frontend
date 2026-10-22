import { useId } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Field } from '@/components/form/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { useCampusChoices } from './campus-choices';
import { BLOOD_TYPES, type StudentInput, type TeacherInput } from './person-schema';

type TeacherProfile = Pick<TeacherInput, 'academicDegree' | 'specialty'>;
type StudentProfile = Pick<
  StudentInput,
  'studentCode' | 'guardianName' | 'guardianPhone' | 'guardianEmail' | 'bloodType'
>;

/** Título y especialidad del docente. */
export function TeacherProfileFields<T extends TeacherProfile>({
  register: registerAny,
  errors,
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<TeacherProfile>;
}) {
  // Los campos son los de TeacherProfile, presentes en cualquier T que lo extienda.
  const register = registerAny as unknown as UseFormRegister<TeacherProfile>;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Título académico (opcional)" error={errors.academicDegree?.message}>
        {(control) => <Input autoComplete="off" {...control} {...register('academicDegree')} />}
      </Field>
      <Field label="Especialidad (opcional)" error={errors.specialty?.message}>
        {(control) => <Input autoComplete="off" {...control} {...register('specialty')} />}
      </Field>
    </div>
  );
}

/** Código, acudiente y tipo de sangre del estudiante. */
export function StudentProfileFields<T extends StudentProfile>({
  register: registerAny,
  errors,
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<StudentProfile>;
}) {
  const register = registerAny as unknown as UseFormRegister<StudentProfile>;
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Código de estudiante (opcional)"
          error={errors.studentCode?.message}
          hint="Único en la institución."
        >
          {(control) => <Input autoComplete="off" {...control} {...register('studentCode')} />}
        </Field>
        <Field
          label="Tipo de sangre (opcional)"
          error={errors.bloodType?.message}
          hint="Dato sensible: solo lo ve quien puede editar al estudiante."
        >
          {(control) => (
            <NativeSelect {...control} {...register('bloodType')}>
              <option value="">Sin dato</option>
              {BLOOD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 font-bold">Acudiente</legend>
        <Field label="Nombre del acudiente (opcional)" error={errors.guardianName?.message}>
          {(control) => <Input autoComplete="off" {...control} {...register('guardianName')} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Teléfono del acudiente (opcional)" error={errors.guardianPhone?.message}>
            {(control) => (
              <Input type="tel" autoComplete="off" {...control} {...register('guardianPhone')} />
            )}
          </Field>
          <Field label="Correo del acudiente (opcional)" error={errors.guardianEmail?.message}>
            {(control) => (
              <Input type="email" autoComplete="off" {...control} {...register('guardianEmail')} />
            )}
          </Field>
        </div>
      </fieldset>
    </>
  );
}

/** Sede: «sin sede» solo si quien edita tiene el permiso en toda la institución. */
export function CampusSelect({
  choices,
  noneLabel,
  error,
  hint,
  disabled,
  ...field
}: ReturnType<UseFormRegister<{ campusId: string }>> & {
  choices: ReturnType<typeof useCampusChoices>;
  noneLabel: string;
  error?: string;
  hint?: string;
}) {
  if (choices.forbidden) {
    return (
      <Field
        label="Sede"
        error={error}
        hint={
          choices.allowNone
            ? 'Sin el permiso de Sedes no puedes ver ni elegir sedes: se crea sin sede y, al editar, conserva la que tiene.'
            : 'Para elegir la sede necesitas también el permiso de Sedes. Pídeselo a un administrador.'
        }
      >
        {(control) => (
          <NativeSelect {...control} disabled>
            <option>{choices.allowNone ? noneLabel : 'Sin acceso a las sedes'}</option>
          </NativeSelect>
        )}
      </Field>
    );
  }
  return (
    <Field label="Sede" error={error} hint={hint}>
      {(control) => (
        <NativeSelect {...control} {...field} disabled={disabled}>
          <option value="">{choices.allowNone ? noneLabel : 'Elige una sede'}</option>
          {choices.options.map((campus) => (
            <option key={campus.value} value={campus.value}>
              {campus.label}
            </option>
          ))}
        </NativeSelect>
      )}
    </Field>
  );
}

/** Filtro «Sede» de un listado (oculto si no hay sedes). */
export function CampusFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 sm:w-52">
      <Label htmlFor={id}>Sede</Label>
      <NativeSelect
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        <option value="">Todas</option>
        {options.map((campus) => (
          <option key={campus.value} value={campus.value}>
            {campus.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
