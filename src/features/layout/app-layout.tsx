import {
  Building2,
  ChevronsUpDown,
  KeyRound,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import { sessionIdentity, useLogout, useSession, useSwitchInstitution } from '@/auth/session';
import { BrandMark, BrandName } from '@/components/brand';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { UserAvatar } from '@/components/user-avatar';
import { SidebarNav } from '@/features/menu/sidebar-nav';
import { useMyAvatar } from '@/features/profile/profile-api';
import { cn } from '@/lib/utils';
import { THEME_OPTIONS } from '@/theme/theme-options';
import { useTheme } from '@/theme/theme-context';
import type { ThemePreference } from '@/theme/theme';

const SIDEBAR_KEY = 'aula360.sidebar';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

/**
 * Celular y tablet (< 1024): menú en panel deslizable. Portátil y escritorio:
 * menú lateral fijo que se puede contraer a íconos.
 */
export function AppLayout() {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = (next: boolean) => {
    setCollapsed(next);
    try {
      if (next) localStorage.setItem(SIDEBAR_KEY, 'collapsed');
      else localStorage.removeItem(SIDEBAR_KEY);
    } catch {
      // Sin almacenamiento: solo dura esta visita.
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] lg:flex',
          collapsed ? 'w-[76px]' : 'w-72',
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center gap-3 px-4',
            collapsed && 'justify-center px-0',
          )}
        >
          <BrandMark className="size-10" />
          {!collapsed && <BrandName className="text-[22px]" />}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav
            collapsed={collapsed}
            onExpand={() => {
              toggleCollapsed(false);
            }}
          />
        </div>
        <div
          className={cn('border-t border-sidebar-border p-3', collapsed && 'flex justify-center')}
        >
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'default'}
            className={cn(!collapsed && 'w-full justify-start font-normal')}
            onClick={() => {
              toggleCollapsed(!collapsed);
            }}
            aria-label={collapsed ? 'Expandir el menú' : 'Contraer el menú'}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
            {!collapsed && 'Contraer menú'}
          </Button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent aria-describedby={undefined}>
          <div className="flex h-16 shrink-0 items-center gap-3 px-4">
            <BrandMark className="size-10" />
            <SheetTitle asChild>
              <BrandName className="text-[22px]" />
            </SheetTitle>
            <SheetDescription className="sr-only">Menú principal</SheetDescription>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNav
              onNavigate={() => {
                setMobileOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className={cn('flex min-h-dvh flex-col', collapsed ? 'lg:pl-[76px]' : 'lg:pl-72')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-5 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir el menú"
            onClick={() => {
              setMobileOpen(true);
            }}
          >
            <Menu aria-hidden="true" />
          </Button>
          <InstitutionSwitcher />
          <div className="ml-auto flex items-center gap-1">
            <ThemeMenu />
            <UserMenu />
          </div>
        </header>
        <main
          id="contenido"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          {/* Con otra cuenta u otra institución la página se monta de nuevo: lo que
              tenga en pantalla (una contraseña temporal, un usuario encontrado)
              no pasa a la sesión nueva (M1 de la 3b-2). */}
          <Outlet key={sessionIdentity(session)} />
        </main>
      </div>
    </div>
  );
}

function InstitutionSwitcher() {
  const { data: session } = useSession();
  const switchInstitution = useSwitchInstitution();
  const navigate = useNavigate();
  if (!session) return null;

  const active = session.institutions.find((i) => i.id === session.activeInstitutionId);
  const label =
    active?.name ??
    (session.user.userType === 'SUPER_ADMIN' ? 'Administración general' : 'Sin institución');

  if (session.institutions.length <= 1) {
    return (
      <div className="flex min-w-0 items-center gap-2 px-2">
        <Building2 className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate font-bold">{label}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="min-w-0 shrink justify-start gap-2 px-2"
          aria-label={`Institución: ${label}. Cambiar de institución`}
        >
          <Building2 className="text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="size-4! text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Cambiar de institución</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={session.activeInstitutionId ?? ''}
          onValueChange={(id) => {
            if (id === session.activeInstitutionId) return;
            switchInstitution.mutate(id, {
              onSuccess: (next) => {
                const name = next.institutions.find((i) => i.id === next.activeInstitutionId)?.name;
                toast.success(name ? `Ahora estás en ${name}.` : 'Institución cambiada.');
                void navigate('/');
              },
              onError: (error) => toast.error(errorMessage(error)),
            });
          }}
        >
          {session.institutions.map((institution) => (
            <DropdownMenuRadioItem key={institution.id} value={institution.id}>
              <span className="truncate">{institution.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeMenu() {
  const { preference, resolved, setPreference } = useTheme();
  const Current = THEME_OPTIONS.find((o) => o.value === resolved)?.Icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Cambiar el tema">
          {Current && <Current aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => {
            setPreference(value as ThemePreference);
          }}
        >
          {THEME_OPTIONS.map(({ value, short, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden="true" />
              {short}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { data: session } = useSession();
  const { data: avatar } = useMyAvatar();
  const logout = useLogout();
  if (!session) return null;
  const { user } = session;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-ring/25"
          aria-label={`Tu cuenta: ${user.firstName} ${user.lastName}`}
        >
          <UserAvatar firstName={user.firstName} lastName={user.lastName} url={avatar?.url} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2.5 py-2">
          <div className="truncate font-bold">
            {user.firstName} {user.lastName}
          </div>
          {user.email && <div className="truncate text-sm text-muted-foreground">{user.email}</div>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserRound aria-hidden="true" />
            Mi perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile#password">
            <KeyRound aria-hidden="true" />
            Cambiar contraseña
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            logout.mutate();
          }}
        >
          <LogOut aria-hidden="true" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
