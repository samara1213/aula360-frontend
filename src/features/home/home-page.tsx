import { Link } from 'react-router';
import { useSession } from '@/auth/session';
import { Skeleton } from '@/components/ui/skeleton';
import { MenuIcon } from '@/features/menu/menu-icon';
import { slugToPath } from '@/features/menu/menu';
import { useNavMenu, type NavNode } from '@/features/menu/nav-menu';
import { MyInvitations } from '@/features/invitations/my-invitations';
import { PageHeader } from '@/features/layout/page-header';

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Opciones con página propia (hojas del árbol), con su grupo. */
function leaves(
  nodes: readonly NavNode[],
  group?: string,
): { node: NavNode; group: string | undefined }[] {
  return nodes.flatMap((node) =>
    node.children.length > 0 ? leaves(node.children, node.name) : [{ node, group }],
  );
}

export function HomePage() {
  const { data: session } = useSession();
  const { nodes: menu, loading } = useNavMenu();
  if (!session) return null;
  const shortcuts = menu ? leaves(menu) : [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`${greeting()}, ${session.user.firstName}`}
        description="Estos son los módulos a los que tienes acceso."
      />
      <MyInvitations />
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : shortcuts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-rule bg-card p-8 text-center">
          <p className="font-bold">Todavía no tienes módulos asignados.</p>
          <p className="mt-1 text-muted-foreground">
            Pide a la administración de tu institución que te asigne un rol.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shortcuts.map(({ node, group }) => (
            <li key={node.id}>
              <Link
                to={slugToPath(node.slug)}
                className="group flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-[border-color,box-shadow] hover:border-primary hover:shadow-[0_12px_30px_-12px_color-mix(in_srgb,var(--primary)_45%,transparent)]"
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <MenuIcon name={node.icon} className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold">{node.name}</span>
                  {group && <span className="block text-sm text-muted-foreground">{group}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
