import { Pencil, Plus, Power, PowerOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { Campus } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataList, Pagination, RowActions, type Column } from '@/components/data/data-list';
import { useListParams } from '@/components/data/list-params';
import { ListToolbar, SearchInput, StatusSelect } from '@/components/data/list-toolbar';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { CampusFormDialog } from './campus-form-dialog';
import { useCampuses, useSetCampusActive, type CampusScope } from './institution-api';

const COLUMNS: Column<Campus>[] = [
  { key: 'name', header: 'Nombre', cell: (c) => c.name },
  { key: 'address', header: 'Dirección', cell: (c) => c.address ?? '—' },
  { key: 'city', header: 'Ciudad', cell: (c) => c.city ?? '—' },
  { key: 'status', header: 'Estado', cell: (c) => <StatusBadge active={c.isActive} /> },
];

const DESCRIPTION =
  'Los lugares donde funciona la institución. Una sede inactiva conserva sus datos.';

/** Diálogo abierto: crear, editar una sede, o confirmar su cambio de estado. */
type Open = { kind: 'create' } | { kind: 'edit' | 'toggle'; campus: Campus } | null;

const ALL = { view: true, create: true, update: true, delete: true };

/** /institution/campuses: sedes de la institución activa. */
export function CampusesPage() {
  return <CampusesList scope={{ kind: 'institution' }} />;
}

/**
 * Sedes de la institución activa o, para el SUPER_ADMIN, de cualquiera
 * (pestaña «Sedes» del detalle de la institución, con `embedded`).
 */
export function CampusesList({
  scope,
  embedded = false,
}: {
  scope: CampusScope;
  embedded?: boolean;
}) {
  const list = useListParams();
  const { data, isPending, isFetching, error, refetch } = useCampuses(list.query, { scope });
  // El backend exige alcance de toda la institución para crear, editar y
  // desactivar sedes: un rol limitado a una sede solo las ve.
  const permissions = usePermissions('institution.campuses').institutionWide;
  const can = scope.kind === 'system' ? ALL : permissions;
  const setActive = useSetCampusActive(scope);
  const [open, setOpen] = useState<Open>(null);
  const close = () => {
    setOpen(null);
  };

  const filtered = list.search !== '' || list.status !== 'active';
  const canAct = can.update || can.delete;
  const newButton = can.create && (
    <Button
      onClick={() => {
        setOpen({ kind: 'create' });
      }}
    >
      <Plus aria-hidden="true" />
      Nueva sede
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-muted-foreground">{DESCRIPTION}</p>
          {newButton}
        </div>
      ) : (
        <PageHeader title="Sedes" description={DESCRIPTION} actions={newButton} />
      )}
      <ListToolbar>
        <SearchInput
          label="Buscar"
          placeholder="Nombre o ciudad"
          value={list.search}
          onChange={(search) => {
            list.update({ search });
          }}
        />
        <StatusSelect
          value={list.status}
          onChange={(status) => {
            list.update({ status });
          }}
        />
      </ListToolbar>
      <DataList
        label="Sedes"
        columns={COLUMNS}
        rows={data?.data}
        getKey={(c) => c.id}
        isPending={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        empty={
          filtered ? (
            <p>Ninguna sede coincide con la búsqueda.</p>
          ) : (
            <>
              <p className="font-bold">Todavía no hay sedes.</p>
              {can.create && (
                <p className="mt-1 text-muted-foreground">Crea la primera con «Nueva sede».</p>
              )}
            </>
          )
        }
        actions={
          canAct
            ? (campus) => (
                <RowActions label={`Acciones de ${campus.name}`}>
                  {can.update && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setOpen({ kind: 'edit', campus });
                      }}
                    >
                      <Pencil aria-hidden="true" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {can.delete && (
                    <DropdownMenuItem
                      variant={campus.isActive ? 'destructive' : undefined}
                      onSelect={() => {
                        setOpen({ kind: 'toggle', campus });
                      }}
                    >
                      {campus.isActive ? (
                        <PowerOff aria-hidden="true" />
                      ) : (
                        <Power aria-hidden="true" />
                      )}
                      {campus.isActive ? 'Desactivar' : 'Reactivar'}
                    </DropdownMenuItem>
                  )}
                </RowActions>
              )
            : undefined
        }
      />
      <Pagination
        meta={data?.meta}
        noun="sedes"
        onPage={(page) => {
          list.update({ page });
        }}
      />

      <Dialog
        open={open?.kind === 'create' || open?.kind === 'edit'}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        {(open?.kind === 'create' || open?.kind === 'edit') && (
          <CampusFormDialog
            scope={scope}
            key={open.kind === 'edit' ? open.campus.id : 'new'}
            campus={open.kind === 'edit' ? open.campus : undefined}
            onDone={close}
          />
        )}
      </Dialog>

      {open?.kind === 'toggle' && (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          title={
            open.campus.isActive
              ? `¿Desactivar «${open.campus.name}»?`
              : `¿Reactivar «${open.campus.name}»?`
          }
          description={
            open.campus.isActive
              ? 'Quienes tienen un rol solo en esta sede pierden ese acceso, y no se podrán crear cursos ni asignar roles en ella. Sus datos se conservan y puedes reactivarla cuando quieras.'
              : 'Vuelve a estar disponible para cursos y roles, y quienes tenían un rol en ella recuperan ese acceso.'
          }
          confirmLabel={open.campus.isActive ? 'Desactivar sede' : 'Reactivar sede'}
          pendingLabel={open.campus.isActive ? 'Desactivando…' : 'Reactivando…'}
          destructive={open.campus.isActive}
          pending={setActive.isPending}
          onConfirm={() => {
            const { campus } = open;
            setActive.mutate(
              { id: campus.id, active: !campus.isActive },
              {
                onSuccess: () => {
                  toast.success(
                    campus.isActive
                      ? `«${campus.name}» quedó inactiva.`
                      : `«${campus.name}» quedó activa.`,
                  );
                  close();
                },
                onError: (err) => toast.error(errorMessage(err)),
              },
            );
          }}
        />
      )}
    </div>
  );
}
