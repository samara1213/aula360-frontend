import { Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { ManagedUser } from '@/api/types';
import { DataList, Pagination, type Column } from '@/components/data/data-list';
import { useListParams } from '@/components/data/list-params';
import { ListToolbar, SearchInput, StatusSelect } from '@/components/data/list-toolbar';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isUuid } from '@/lib/ids';
import { roleLabel } from '@/lib/roles';
import { useAssignmentOptions } from './assignment-options';
import { CreateUserDialog } from './create-user-dialog';
import { useUsers, type UsersScope } from './users-api';

const MALE: readonly [string, string] = ['Activo', 'Inactivo'];

/** Roles de un usuario en la institución, con la sede si es de una sola. */
export function AssignmentBadges({ user }: { user: ManagedUser }) {
  if (user.assignments.length === 0) {
    return <span className="text-muted-foreground">Sin roles</span>;
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {user.assignments.map((a) => (
        <Badge key={a.id}>
          {roleLabel(a.role)}
          {a.campus && ` · ${a.campus.name}`}
        </Badge>
      ))}
    </span>
  );
}

/**
 * Listado de usuarios con filtros en la URL y el alta. Lo usan
 * /security/users (institución activa) y la pestaña «Usuarios» del detalle de
 * una institución (SUPER_ADMIN).
 */
export function UsersList({
  scope,
  detailPath,
  canCreate,
}: {
  scope: UsersScope;
  /** Ruta del detalle de un usuario. */
  detailPath: (id: string) => string;
  canCreate: boolean;
}) {
  const list = useListParams();
  const [params, setParams] = useSearchParams();
  // Filtros extra: solo ids con formato válido llegan a la API.
  const roleId = params.get('role') ?? '';
  const campusId = params.get('campus') ?? '';
  const filter = {
    ...list.query,
    ...(isUuid(roleId) ? { roleId } : {}),
    ...(isUuid(campusId) ? { campusId } : {}),
  };
  const { data, isPending, isFetching, error, refetch } = useUsers(scope, filter);
  const options = useAssignmentOptions(scope);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const roleSelect = useId();
  const campusSelect = useId();

  const setFilter = (key: 'role' | 'campus', value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      return next;
    });
  };

  const columns: Column<ManagedUser>[] = [
    {
      key: 'name',
      header: 'Nombre',
      cell: (user) => (
        <Link
          to={detailPath(user.id)}
          className="rounded-md text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/25"
        >
          {user.firstName} {user.lastName}
        </Link>
      ),
    },
    {
      key: 'document',
      header: 'Documento',
      cell: (user) =>
        user.documentNumber ? `${user.documentType ?? ''} ${user.documentNumber}`.trim() : '—',
    },
    { key: 'email', header: 'Correo', cell: (user) => user.email ?? '—', className: 'break-all' },
    { key: 'roles', header: 'Roles', cell: (user) => <AssignmentBadges user={user} /> },
    {
      key: 'status',
      header: 'Estado',
      cell: (user) => <StatusBadge active={user.isActive} labels={MALE} />,
    },
  ];
  const filtered = list.search !== '' || list.status !== 'active' || roleId || campusId;

  return (
    <div className="flex flex-col gap-6">
      {canCreate && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setCreating(true);
            }}
          >
            <Plus aria-hidden="true" />
            Nuevo usuario
          </Button>
        </div>
      )}
      <ListToolbar>
        <SearchInput
          label="Buscar"
          placeholder="Nombre, documento o correo"
          value={list.search}
          onChange={(search) => {
            list.update({ search });
          }}
        />
        <StatusSelect
          value={list.status}
          labels={['Activos', 'Inactivos', 'Todos']}
          onChange={(status) => {
            list.update({ status });
          }}
        />
        <div className="flex flex-col gap-2 sm:w-52">
          <Label htmlFor={roleSelect}>Rol</Label>
          <NativeSelect
            id={roleSelect}
            value={roleId}
            onChange={(e) => {
              setFilter('role', e.target.value);
            }}
          >
            <option value="">Todos</option>
            {options.roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        {scope.kind === 'institution' && options.campuses.length > 0 && (
          <div className="flex flex-col gap-2 sm:w-52">
            <Label htmlFor={campusSelect}>Sede</Label>
            <NativeSelect
              id={campusSelect}
              value={campusId}
              onChange={(e) => {
                setFilter('campus', e.target.value);
              }}
            >
              <option value="">Todas</option>
              {options.campuses.map((campus) => (
                <option key={campus.value} value={campus.value}>
                  {campus.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
      </ListToolbar>
      <DataList
        label="Usuarios"
        columns={columns}
        rows={data?.data}
        getKey={(user) => user.id}
        isPending={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        empty={
          filtered ? (
            <p>Ningún usuario coincide con los filtros.</p>
          ) : (
            <p className="font-bold">Todavía no hay usuarios.</p>
          )
        }
      />
      <Pagination
        meta={data?.meta}
        noun="usuarios"
        onPage={(page) => {
          list.update({ page });
        }}
      />
      <Dialog open={creating} onOpenChange={setCreating}>
        {creating && (
          <CreateUserDialog
            scope={scope}
            onDone={(createdId) => {
              setCreating(false);
              if (createdId) void navigate(detailPath(createdId));
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
