import { ChevronDown, House } from 'lucide-react';
import { useId, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import type { MenuNode } from '@/api/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { MenuIcon } from './menu-icon';
import { slugToPath, useMyMenu } from './menu';

type NavProps = {
  /** Solo íconos del primer nivel (menú contraído en portátil). */
  collapsed?: boolean;
  onNavigate?: () => void;
  onExpand?: () => void;
};

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors',
    isActive
      ? 'bg-sidebar-accent font-bold text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--sidebar-primary)]'
      : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
  );

/**
 * Menú dinámico (Padre → Hijo → Nieto) desde GET /menu-options/my-menu. Las
 * opciones con hijos son grupos (no tienen página propia).
 */
export function SidebarNav({ collapsed = false, onNavigate, onExpand }: NavProps) {
  const { data: menu, isPending, isError, refetch, fetchStatus } = useMyMenu();

  return (
    <nav aria-label="Menú principal" className="flex flex-col gap-1 p-3">
      <NavLink
        to="/"
        end
        className={linkClasses}
        onClick={onNavigate}
        title={collapsed ? 'Inicio' : undefined}
      >
        <House className="size-5 shrink-0" aria-hidden="true" />
        <span className={cn(collapsed && 'sr-only')}>Inicio</span>
      </NavLink>

      {isPending && fetchStatus !== 'idle' && (
        <div className="flex flex-col gap-2 pt-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      )}
      {isError && !collapsed && (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          No pudimos cargar el menú.{' '}
          <button
            type="button"
            className="cursor-pointer font-bold text-primary underline"
            onClick={() => void refetch()}
          >
            Reintentar
          </button>
        </p>
      )}
      {menu?.map((node) =>
        collapsed ? (
          <CollapsedItem key={node.id} node={node} onExpand={onExpand} />
        ) : (
          <NavNode key={node.id} node={node} depth={0} onNavigate={onNavigate} />
        ),
      )}
    </nav>
  );
}

function containsPath(node: MenuNode, pathname: string): boolean {
  if (pathname === slugToPath(node.slug) || pathname.startsWith(slugToPath(node.slug) + '/'))
    return true;
  return node.children.some((child) => containsPath(child, pathname));
}

function NavNode({
  node,
  depth,
  onNavigate,
}: {
  node: MenuNode;
  depth: number;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => depth === 0 || containsPath(node, pathname));
  const groupId = useId();
  const indent = depth > 0 ? { paddingLeft: `${String(12 + depth * 20)}px` } : undefined;

  if (node.children.length === 0) {
    return (
      <NavLink
        to={slugToPath(node.slug)}
        className={linkClasses}
        style={indent}
        onClick={onNavigate}
      >
        <MenuIcon name={node.icon} className="size-5 shrink-0" />
        <span className="min-w-0 truncate">{node.name}</span>
      </NavLink>
    );
  }

  return (
    <div className={cn(depth === 0 && 'pt-2')}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={groupId}
        onClick={() => {
          setOpen((v) => !v);
        }}
        style={indent}
        className={cn(
          'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left hover:bg-sidebar-accent/60',
          depth === 0
            ? 'text-sm font-bold text-muted-foreground'
            : 'text-[15px] text-sidebar-foreground/85',
        )}
      >
        <MenuIcon name={node.icon} className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <ChevronDown
          className={cn('size-4 shrink-0 transition-transform', !open && '-rotate-90')}
          aria-hidden="true"
        />
      </button>
      <div id={groupId} hidden={!open} className="flex flex-col gap-0.5">
        {node.children.map((child) => (
          <NavNode key={child.id} node={child} depth={depth + 1} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function CollapsedItem({ node, onExpand }: { node: MenuNode; onExpand?: () => void }) {
  const { pathname } = useLocation();
  const active = containsPath(node, pathname);
  return (
    <button
      type="button"
      title={node.name}
      aria-label={`${node.name} (abrir el menú completo)`}
      onClick={onExpand}
      className={cn(
        'flex min-h-11 cursor-pointer items-center justify-center rounded-lg hover:bg-sidebar-accent/60',
        active && 'bg-sidebar-accent text-sidebar-accent-foreground',
      )}
    >
      <MenuIcon name={node.icon} className="size-5" />
    </button>
  );
}
