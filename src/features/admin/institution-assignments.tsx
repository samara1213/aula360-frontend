import { zodResolver } from '@hookform/resolvers/zod';
import { Search, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError, errorMessage } from '@/api/errors';
import type { RoleAssignment, UserLookup } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataList, Pagination, type Column } from '@/components/data/data-list';
import { PAGE_SIZE } from '@/components/data/list-params';
import { Field } from '@/components/form/field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { useAssignmentOptions } from '@/features/security/assignment-options';
import {
  useCreateAssignment,
  useDeleteAssignment,
  useInstitutionAssignments,
  useLookupUser,
} from '@/features/security/users-api';
import { formatDate } from '@/lib/format';
import { DOCUMENT_TYPES } from '@/lib/document-types';
import { roleLabel } from '@/lib/roles';

/** Pestaña «Asignaciones» del detalle de una institución (SUPER_ADMIN). */
export function InstitutionAssignments({ institutionId }: { institutionId: string }) {
  const [page, setPage] = useState(1);
  const { data, isPending, isFetching, error, refetch } = useInstitutionAssignments(institutionId, {
    page,
    limit: PAGE_SIZE,
  });
  const scope = { kind: 'system', institutionId } as const;
  const remove = useDeleteAssignment(scope);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<RoleAssignment | null>(null);

  const columns: Column<RoleAssignment>[] = [
    {
      key: 'user',
      header: 'Persona',
      cell: (a) => (
        <Link
          to={`/admin/institutions/${encodeURIComponent(institutionId)}/users/${encodeURIComponent(a.user.id)}`}
          className="rounded-md text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/25"
        >
          {a.user.firstName} {a.user.lastName}
        </Link>
      ),
    },
    {
      key: 'document',
      header: 'Documento',
      cell: (a) =>
        a.user.documentNumber
          ? `${a.user.documentType ?? ''} ${a.user.documentNumber}`.trim()
          : '—',
    },
    { key: 'role', header: 'Rol', cell: (a) => roleLabel(a.role) },
    {
      key: 'campus',
      header: 'Dónde',
      cell: (a) => (a.campus ? a.campus.name : 'Toda la institución'),
    },
    { key: 'since', header: 'Desde', cell: (a) => formatDate(a.createdAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-prose text-muted-foreground">
          Quién tiene qué rol en esta institución. Puedes darle un rol a alguien que ya usa Aula360
          en otra institución.
        </p>
        <Button
          className="self-start sm:self-auto"
          onClick={() => {
            setAdding(true);
          }}
        >
          <UserPlus aria-hidden="true" />
          Asignar a un usuario existente
        </Button>
      </div>
      <DataList
        label="Asignaciones de rol"
        columns={columns}
        rows={data?.data}
        getKey={(a) => a.id}
        isPending={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        empty={<p className="font-bold">Nadie tiene roles en esta institución todavía.</p>}
        actions={(a) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Quitar el rol ${roleLabel(a.role)} a ${a.user.firstName} ${a.user.lastName}`}
            onClick={() => {
              setRemoving(a);
            }}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      />
      <Pagination meta={data?.meta} noun="asignaciones" onPage={setPage} />

      <Dialog open={adding} onOpenChange={setAdding}>
        {adding && (
          <AssignExistingUserDialog
            institutionId={institutionId}
            onDone={() => {
              setAdding(false);
            }}
          />
        )}
      </Dialog>
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setRemoving(null);
          }}
          title={`¿Quitar el rol ${roleLabel(removing.role)} a ${removing.user.firstName} ${removing.user.lastName}?`}
          description="Deja de tener los permisos de ese rol en esta institución. Su cuenta y sus otros roles se conservan."
          confirmLabel="Quitar rol"
          pendingLabel="Quitando…"
          destructive
          pending={remove.isPending}
          onConfirm={() => {
            remove.mutate(removing.id, {
              onSuccess: () => {
                toast.success('Rol quitado.');
                setRemoving(null);
              },
              onError: (err) => toast.error(errorMessage(err)),
            });
          }}
        />
      )}
    </div>
  );
}

const lookupSchema = z
  .object({
    by: z.enum(['email', 'document']),
    email: z.string().trim(),
    documentType: z.string(),
    documentNumber: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.by === 'email' && !z.email().safeParse(v.email).success) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Escribe el correo completo.' });
    }
    if (v.by === 'document' && !/^[0-9A-Za-z-]{1,50}$/.test(v.documentNumber)) {
      ctx.addIssue({
        code: 'custom',
        path: ['documentNumber'],
        message: 'Escribe el número completo, sin espacios ni puntos.',
      });
    }
  });
type LookupValues = z.infer<typeof lookupSchema>;

/**
 * Buscar a alguien por correo o documento (coincidencia exacta) y darle un rol
 * global en esta institución. Va dentro de un <Dialog>.
 */
function AssignExistingUserDialog({
  institutionId,
  onDone,
}: {
  institutionId: string;
  onDone: () => void;
}) {
  const lookup = useLookupUser();
  const [found, setFound] = useState<UserLookup | null>(null);
  const form = useForm<LookupValues>({
    resolver: zodResolver(lookupSchema),
    defaultValues: { by: 'email', email: '', documentType: 'CC', documentNumber: '' },
  });
  const by = useWatch({ control: form.control, name: 'by' });
  const { errors } = form.formState;
  const notFound = lookup.error instanceof ApiError && lookup.error.status === 404;

  const onSearch = form.handleSubmit((values) => {
    setFound(null);
    lookup.mutate(
      values.by === 'email'
        ? { email: values.email }
        : { documentType: values.documentType, documentNumber: values.documentNumber },
      { onSuccess: setFound },
    );
  });

  return (
    <DialogContent
      title="Asignar a un usuario existente"
      description="Búscalo con su correo o su documento completos."
      footer={
        <DialogClose asChild>
          <Button variant="outline">Cancelar</Button>
        </DialogClose>
      }
    >
      <div className="flex flex-col gap-6">
        <form noValidate onSubmit={(e) => void onSearch(e)} className="flex flex-col gap-4">
          <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
            <legend className="mb-2 font-bold">Buscar por</legend>
            {(['email', 'document'] as const).map((value) => (
              <label key={value} className="inline-flex min-h-11 cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  value={value}
                  className="size-5 accent-primary"
                  {...form.register('by')}
                />
                {value === 'email' ? 'Correo electrónico' : 'Documento de identidad'}
              </label>
            ))}
          </fieldset>
          {by === 'email' ? (
            <Field label="Correo" error={errors.email?.message}>
              {(control) => (
                <Input type="email" autoComplete="off" {...control} {...form.register('email')} />
              )}
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
              <Field label="Tipo" error={errors.documentType?.message}>
                {(control) => (
                  <NativeSelect {...control} {...form.register('documentType')}>
                    {DOCUMENT_TYPES.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field label="Número" error={errors.documentNumber?.message}>
                {(control) => (
                  <Input autoComplete="off" {...control} {...form.register('documentNumber')} />
                )}
              </Field>
            </div>
          )}
          <Button
            type="submit"
            variant="outline"
            className="self-start"
            disabled={lookup.isPending}
          >
            <Search aria-hidden="true" />
            {lookup.isPending ? 'Buscando…' : 'Buscar'}
          </Button>
          {notFound && (
            <Alert>
              No hay un usuario activo con esos datos. Revisa que estén completos, o créalo desde la
              pestaña «Usuarios».
            </Alert>
          )}
          {lookup.isError && !notFound && (
            <Alert variant="error">{errorMessage(lookup.error)}</Alert>
          )}
        </form>
        {found && (
          <AssignFound key={found.id} institutionId={institutionId} user={found} onDone={onDone} />
        )}
      </div>
    </DialogContent>
  );
}

function AssignFound({
  institutionId,
  user,
  onDone,
}: {
  institutionId: string;
  user: UserLookup;
  onDone: () => void;
}) {
  const scope = { kind: 'system', institutionId } as const;
  const options = useAssignmentOptions(scope);
  const create = useCreateAssignment(scope);
  const [roleId, setRoleId] = useState('');
  const [missingRole, setMissingRole] = useState(false);
  const name = `${user.firstName} ${user.lastName}`;

  return (
    <section
      aria-label="Usuario encontrado"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-secondary/50 p-4"
    >
      <div>
        <div className="font-bold">{name}</div>
        <div className="text-sm break-all text-muted-foreground">
          {user.documentType} {user.documentNumber}
          {user.email && ` · ${user.email}`}
        </div>
      </div>
      {create.isError && <Alert variant="error">{errorMessage(create.error)}</Alert>}
      <Field label="Rol en esta institución" error={missingRole ? 'Elige el rol.' : undefined}>
        {(control) => (
          <NativeSelect
            {...control}
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value);
              setMissingRole(false);
            }}
          >
            <option value="">Elige un rol</option>
            {options.roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <Button
        className="self-start"
        disabled={create.isPending}
        onClick={() => {
          if (!roleId) {
            setMissingRole(true);
            return;
          }
          create.mutate(
            { userId: user.id, roleId, campusId: null },
            {
              onSuccess: () => {
                toast.success(`Rol asignado a ${name}.`);
                onDone();
              },
            },
          );
        }}
      >
        {create.isPending ? 'Asignando…' : `Asignar rol a ${user.firstName}`}
      </Button>
    </section>
  );
}
