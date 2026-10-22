import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ApiError, errorMessage } from '@/api/errors';
import type { MenuNode, MenuOptionNode, RoleDetail } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/features/layout/page-header';
import { NotFoundPage } from '@/features/layout/status-pages';
import { useMyMenu } from '@/features/menu/menu';
import { isUuid } from '@/lib/ids';
import { roleLabel } from '@/lib/roles';
import { PermissionMatrix } from './permission-matrix';
import {
  exceedsCeiling,
  grantsFrom,
  sameGrants,
  toggle,
  toInput,
  type Ceiling,
  type Grants,
  type MatrixRow,
} from './permission-matrix-logic';
import {
  useDeleteRole,
  useMenuTree,
  useReplacePermissions,
  useRole,
  type RoleScope,
} from './roles-api';
import { isEditable, ROLE_PATHS, useRolePermissions } from './role-scope';
import { EditRoleDialog } from './roles-page';

/** Filas desde el menú propio (roles de la institución): lo que se puede otorgar. */
function rowsFromMyMenu(nodes: readonly MenuNode[]): MatrixRow[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    children: rowsFromMyMenu(node.children),
  }));
}

/** Tope: los permisos propios en toda la institución (el backend usa ese). */
function ceilingFromMyMenu(nodes: readonly MenuNode[]): Record<string, MenuNode['permissions']> {
  return Object.fromEntries(
    nodes.flatMap((node) => [
      ...(node.institutionWide.view ? [[node.id, node.institutionWide] as const] : []),
      ...Object.entries(ceilingFromMyMenu(node.children)),
    ]),
  );
}

/** Filas desde el árbol completo (roles globales), con las opciones inactivas. */
function rowsFromTree(nodes: readonly MenuOptionNode[]): MatrixRow[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    inactive: !node.isActive,
    children: rowsFromTree(node.children),
  }));
}

/** /security/roles/:id y /admin/global-roles/:id: datos y permisos de un rol. */
export function RoleDetailPage({ scope }: { scope: RoleScope }) {
  const { id = '' } = useParams();
  const { data: role, isPending, error, refetch } = useRole(scope, id);
  const base = ROLE_PATHS[scope];

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={base}
        className="inline-flex min-h-11 items-center gap-1 self-start rounded-md font-bold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/25"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
        {scope === 'global' ? 'Roles globales' : 'Roles'}
      </Link>
      {!isUuid(id) ? (
        <NotFoundPage />
      ) : isPending ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <Skeleton className="h-10 w-2/3 max-w-md" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : error ? (
        error instanceof ApiError && (error.status === 404 || error.status === 400) ? (
          <NotFoundPage />
        ) : (
          <Alert variant="error">
            No pudimos cargar el rol.{' '}
            <button
              type="button"
              className="cursor-pointer font-bold text-primary underline"
              onClick={() => void refetch()}
            >
              Reintentar
            </button>
          </Alert>
        )
      ) : (
        <RoleDetail key={role.id} scope={scope} role={role} />
      )}
    </div>
  );
}

function RoleDetail({ scope, role }: { scope: RoleScope; role: RoleDetail }) {
  const can = useRolePermissions(scope);
  const editable = isEditable(scope, role);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = useDeleteRole(scope);
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title={roleLabel(role)}
        description={
          <span className="flex flex-col gap-2">
            {role.isGlobal && scope === 'institution' && (
              <span>
                <Badge>Global</Badge>
              </span>
            )}
            {role.description ?? 'Sin descripción.'}
          </span>
        }
        actions={
          editable && (
            <>
              {can.update && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(true);
                  }}
                >
                  <Pencil aria-hidden="true" />
                  Editar nombre
                </Button>
              )}
              {can.delete && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleting(true);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Borrar rol
                </Button>
              )}
            </>
          )
        }
      />
      <PermissionsSection scope={scope} role={role} canEdit={editable && can.update} />

      <Dialog open={editing} onOpenChange={setEditing}>
        {editing && (
          <EditRoleDialog
            scope={scope}
            role={role}
            onDone={() => {
              setEditing(false);
            }}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`¿Borrar el rol ${role.name}?`}
        description="Se borra con sus permisos. Si alguien lo tiene asignado no se puede borrar: primero quita esas asignaciones."
        confirmLabel="Borrar rol"
        pendingLabel="Borrando…"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          remove.mutate(role.id, {
            onSuccess: () => {
              toast.success(`Rol ${role.name} borrado.`);
              void navigate(ROLE_PATHS[scope]);
            },
            onError: (err) => toast.error(errorMessage(err)),
          });
        }}
      />
    </>
  );
}

function PermissionsSection({
  scope,
  role,
  canEdit,
}: {
  scope: RoleScope;
  role: RoleDetail;
  canEdit: boolean;
}) {
  const myMenu = useMyMenu();
  const tree = useMenuTree(scope === 'global');
  const source = scope === 'global' ? tree : myMenu;

  if (source.isPending) return <Skeleton className="h-96 rounded-2xl" />;
  if (source.isError) {
    return (
      <Alert variant="error">
        No pudimos cargar las opciones del menú.{' '}
        <button
          type="button"
          className="cursor-pointer font-bold text-primary underline"
          onClick={() => void source.refetch()}
        >
          Reintentar
        </button>
      </Alert>
    );
  }
  const rows =
    scope === 'global' ? rowsFromTree(tree.data ?? []) : rowsFromMyMenu(myMenu.data ?? []);
  const ceiling: Ceiling = scope === 'global' ? null : ceilingFromMyMenu(myMenu.data ?? []);
  return (
    <MatrixEditor
      // Se monta de nuevo si el rol cambia en el servidor (otra pestaña, otro usuario).
      key={JSON.stringify(role.permissions)}
      scope={scope}
      role={role}
      rows={rows}
      ceiling={ceiling}
      canEdit={canEdit}
    />
  );
}

function MatrixEditor({
  scope,
  role,
  rows,
  ceiling,
  canEdit,
}: {
  scope: RoleScope;
  role: RoleDetail;
  rows: MatrixRow[];
  ceiling: Ceiling;
  canEdit: boolean;
}) {
  const saved = grantsFrom(role.permissions);
  const [grants, setGrants] = useState<Grants>(saved);
  const replace = useReplacePermissions(scope, role.id);
  const tooBroad = canEdit && exceedsCeiling(saved, rows, ceiling);
  const readOnly = !canEdit || tooBroad;
  const dirty = !sameGrants(grants, saved);

  return (
    <Section
      title="Permisos"
      description={
        readOnly
          ? 'Qué puede ver y hacer quien tenga este rol.'
          : 'Marca qué puede ver y hacer quien tenga este rol. Solo puedes otorgar permisos que tú tienes en toda la institución. Las opciones desactivadas no aparecen aquí: el rol conserva sus permisos en ellas para cuando se reactiven.'
      }
    >
      {scope === 'institution' && role.isGlobal && (
        <Alert>Los roles globales los define la administración general de Aula360.</Alert>
      )}
      {tooBroad && (
        <Alert>
          Este rol tiene permisos que tú no tienes, así que no puedes cambiarlo. Pídeselo a quien
          tenga esos permisos.
        </Alert>
      )}
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No hay opciones de menú para mostrar.</p>
      ) : (
        <PermissionMatrix
          rows={rows}
          grants={grants}
          ceiling={ceiling}
          readOnly={readOnly}
          onToggle={(id, action, checked) => {
            setGrants((current) => toggle(current, rows, ceiling, id, action, checked));
          }}
        />
      )}
      {replace.isError && <Alert variant="error">{errorMessage(replace.error)}</Alert>}
      {!readOnly && (
        <div className="sticky bottom-3 z-10 flex max-w-4xl items-center gap-2 rounded-xl border border-border bg-card/95 p-3 shadow-[0_12px_30px_-12px_rgb(15_21_48/0.35)] backdrop-blur-sm">
          <Button
            disabled={!dirty || replace.isPending}
            onClick={() => {
              replace.mutate(toInput(grants, rows, role.permissions), {
                onSuccess: () => toast.success('Permisos guardados.'),
              });
            }}
          >
            {replace.isPending ? 'Guardando…' : 'Guardar permisos'}
          </Button>
          <Button
            variant="ghost"
            disabled={!dirty || replace.isPending}
            onClick={() => {
              setGrants(saved);
              replace.reset();
            }}
          >
            Descartar
          </Button>
          <span className="hidden text-sm text-muted-foreground sm:inline" aria-live="polite">
            {dirty ? 'Hay cambios sin guardar.' : 'Sin cambios.'}
          </span>
        </div>
      )}
    </Section>
  );
}
