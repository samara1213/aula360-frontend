import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { Role } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataList, Pagination, RowActions, type Column } from '@/components/data/data-list';
import { useListParams } from '@/components/data/list-params';
import { ListToolbar, SearchInput } from '@/components/data/list-toolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/features/layout/page-header';
import { roleLabel } from '@/lib/roles';
import { RoleFormDialog } from './role-form-dialog';
import { isEditable, ROLE_PATHS, useRolePermissions } from './role-scope';
import { useCreateRole, useDeleteRole, useRoles, useUpdateRole, type RoleScope } from './roles-api';

type Open = { kind: 'create' } | { kind: 'edit' | 'delete'; role: Role } | null;

/** /security/roles (roles de la institución) y /admin/global-roles (SUPER_ADMIN). */
export function RolesPage({ scope }: { scope: RoleScope }) {
  const list = useListParams();
  const { data, isPending, isFetching, error, refetch } = useRoles(scope, {
    page: list.query.page,
    limit: list.query.limit,
    ...(list.query.search ? { search: list.query.search } : {}),
  });
  const can = useRolePermissions(scope);
  const [open, setOpen] = useState<Open>(null);
  const close = () => {
    setOpen(null);
  };
  const create = useCreateRole(scope);
  const remove = useDeleteRole(scope);
  const navigate = useNavigate();
  const base = ROLE_PATHS[scope];

  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: 'Rol',
      cell: (role) => (
        <Link
          to={`${base}/${encodeURIComponent(role.id)}`}
          className="rounded-md text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/25"
        >
          {roleLabel(role)}
        </Link>
      ),
    },
    {
      key: 'description',
      header: 'Descripción',
      cell: (role) => role.description ?? '—',
      className: 'max-w-md',
    },
    ...(scope === 'institution'
      ? [
          {
            key: 'kind',
            header: 'Tipo',
            cell: (role: Role) =>
              role.isGlobal ? (
                <Badge>Global</Badge>
              ) : (
                <Badge variant="inactive">De la institución</Badge>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={scope === 'global' ? 'Roles globales' : 'Roles'}
        description={
          scope === 'global'
            ? 'Roles que existen en todas las instituciones (administrador, docente, estudiante...).'
            : 'Qué puede ver y hacer cada rol. Los globales los define la administración general de Aula360.'
        }
        actions={
          can.create && (
            <Button
              onClick={() => {
                setOpen({ kind: 'create' });
              }}
            >
              <Plus aria-hidden="true" />
              Nuevo rol
            </Button>
          )
        }
      />
      <ListToolbar>
        <SearchInput
          label="Buscar"
          placeholder="Nombre del rol"
          value={list.search}
          onChange={(search) => {
            list.update({ search });
          }}
        />
      </ListToolbar>
      <DataList
        label={scope === 'global' ? 'Roles globales' : 'Roles'}
        columns={columns}
        rows={data?.data}
        getKey={(role) => role.id}
        isPending={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        empty={
          list.search ? <p>Ningún rol coincide con la búsqueda.</p> : <p>Todavía no hay roles.</p>
        }
        actions={(role) =>
          isEditable(scope, role) && (can.update || can.delete) ? (
            <RowActions label={`Acciones de ${role.name}`}>
              {can.update && (
                <DropdownMenuItem
                  onSelect={() => {
                    setOpen({ kind: 'edit', role });
                  }}
                >
                  <Pencil aria-hidden="true" />
                  Editar nombre
                </DropdownMenuItem>
              )}
              {can.delete && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    setOpen({ kind: 'delete', role });
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Borrar
                </DropdownMenuItem>
              )}
            </RowActions>
          ) : null
        }
      />
      <Pagination
        meta={data?.meta}
        noun="roles"
        onPage={(page) => {
          list.update({ page });
        }}
      />

      <Dialog
        open={open?.kind === 'create'}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        {open?.kind === 'create' && (
          <RoleFormDialog
            pending={create.isPending}
            error={create.error}
            onSubmit={(body) => {
              create.mutate(body, {
                onSuccess: (role) => {
                  toast.success(`Rol «${role.name}» creado. Ahora elige sus permisos.`);
                  close();
                  void navigate(`${base}/${encodeURIComponent(role.id)}`);
                },
              });
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={open?.kind === 'edit'}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        {open?.kind === 'edit' && (
          <EditRoleDialog key={open.role.id} scope={scope} role={open.role} onDone={close} />
        )}
      </Dialog>

      {open?.kind === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          title={`¿Borrar el rol ${open.role.name}?`}
          description="Se borra con sus permisos. Si alguien lo tiene asignado no se puede borrar: primero quita esas asignaciones."
          confirmLabel="Borrar rol"
          pendingLabel="Borrando…"
          destructive
          pending={remove.isPending}
          onConfirm={() => {
            const { role } = open;
            remove.mutate(role.id, {
              onSuccess: () => {
                toast.success(`Rol ${role.name} borrado.`);
                close();
              },
              onError: (err) => toast.error(errorMessage(err)),
            });
          }}
        />
      )}
    </div>
  );
}

export function EditRoleDialog({
  scope,
  role,
  onDone,
}: {
  scope: RoleScope;
  role: Role;
  onDone: () => void;
}) {
  const update = useUpdateRole(scope, role.id);
  return (
    <RoleFormDialog
      role={role}
      pending={update.isPending}
      error={update.error}
      onSubmit={(body) => {
        update.mutate(body, {
          onSuccess: () => {
            toast.success('Rol guardado.');
            onDone();
          },
        });
      }}
    />
  );
}
