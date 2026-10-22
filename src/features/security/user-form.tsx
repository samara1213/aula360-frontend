import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Field } from '@/components/form/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { DOCUMENT_TYPES } from '@/lib/document-types';
import type { PersonalDataInput } from './user-schema';

/** Documento, nombres, correo y teléfono. */
export function PersonalDataFields<T extends PersonalDataInput>({
  register,
  errors,
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<PersonalDataInput>;
}) {
  // Los campos son los de PersonalDataInput, presentes en cualquier T que lo extienda.
  const reg = register as unknown as UseFormRegister<PersonalDataInput>;
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <Field label="Tipo de documento" error={errors.documentType?.message}>
          {(control) => (
            <NativeSelect {...control} {...reg('documentType')}>
              {DOCUMENT_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Número de documento" error={errors.documentNumber?.message}>
          {(control) => (
            <Input autoComplete="off" inputMode="text" {...control} {...reg('documentNumber')} />
          )}
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombres" error={errors.firstName?.message}>
          {(control) => <Input autoComplete="off" {...control} {...reg('firstName')} />}
        </Field>
        <Field label="Apellidos" error={errors.lastName?.message}>
          {(control) => <Input autoComplete="off" {...control} {...reg('lastName')} />}
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Correo (opcional)"
          error={errors.email?.message}
          hint="Recibe la contraseña temporal y puede recuperar su contraseña."
        >
          {(control) => <Input type="email" autoComplete="off" {...control} {...reg('email')} />}
        </Field>
        <Field label="Teléfono (opcional)" error={errors.phone?.message}>
          {(control) => <Input type="tel" autoComplete="off" {...control} {...reg('phone')} />}
        </Field>
      </div>
    </>
  );
}
