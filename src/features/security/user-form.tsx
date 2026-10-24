import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Field } from '@/components/form/field';
import { Alert } from '@/components/ui/alert';
import { Input, NativeSelect } from '@/components/ui/input';
import { DOCUMENT_TYPES } from '@/lib/document-types';
import type { PersonalDataInput } from './user-schema';

/** Documento, nombres, correo y teléfono. */
export function PersonalDataFields<T extends PersonalDataInput>({
  register,
  errors,
  locked,
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<PersonalDataInput>;
  /**
   * Cuenta compartida con otra institución: los datos personales se ven pero
   * no se editan (los cambia el SUPER_ADMIN). Se pasa el tipo de documento
   * guardado, que se muestra como texto.
   */
  locked?: { documentType: string };
}) {
  // Los campos son los de PersonalDataInput, presentes en cualquier T que lo extienda.
  const reg = register as unknown as UseFormRegister<PersonalDataInput>;
  // readOnly (no disabled): el valor sigue en el formulario y pasa la validación.
  const lock = locked ? { readOnly: true, className: 'bg-muted/50' } : {};
  return (
    <>
      {locked && (
        <Alert>
          Esta persona también está en otra institución: su nombre, documento, correo y teléfono
          solo los cambia el administrador de la plataforma.
        </Alert>
      )}
      <div className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <Field label="Tipo de documento" error={errors.documentType?.message}>
          {(control) =>
            locked ? (
              <Input
                {...control}
                {...lock}
                value={
                  DOCUMENT_TYPES.find((t) => t.value === locked.documentType)?.label ??
                  locked.documentType
                }
              />
            ) : (
              <NativeSelect {...control} {...reg('documentType')}>
                {DOCUMENT_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            )
          }
        </Field>
        <Field label="Número de documento" error={errors.documentNumber?.message}>
          {(control) => (
            <Input
              autoComplete="off"
              inputMode="text"
              {...control}
              {...reg('documentNumber')}
              {...lock}
            />
          )}
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombres" error={errors.firstName?.message}>
          {(control) => <Input autoComplete="off" {...control} {...reg('firstName')} {...lock} />}
        </Field>
        <Field label="Apellidos" error={errors.lastName?.message}>
          {(control) => <Input autoComplete="off" {...control} {...reg('lastName')} {...lock} />}
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Correo (opcional)"
          error={errors.email?.message}
          hint="Recibe la contraseña temporal y puede recuperar su contraseña."
        >
          {(control) => (
            <Input type="email" autoComplete="off" {...control} {...reg('email')} {...lock} />
          )}
        </Field>
        <Field label="Teléfono (opcional)" error={errors.phone?.message}>
          {(control) => (
            <Input type="tel" autoComplete="off" {...control} {...reg('phone')} {...lock} />
          )}
        </Field>
      </div>
    </>
  );
}
