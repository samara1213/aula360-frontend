import { Construction, FileQuestion, ShieldX, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { isRouteErrorResponse, Link, useParams, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';
import { findBySlug, useMyMenu } from '@/features/menu/menu';

function StatusPage({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-secondary text-primary">
        {icon}
      </span>
      <h1 className="text-[28px] font-extrabold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

export function NotFoundPage() {
  return (
    <StatusPage
      icon={<FileQuestion className="size-8" aria-hidden="true" />}
      title="No encontramos esta página"
    >
      <p className="text-muted-foreground">
        Puede que el enlace esté mal escrito, que la página ya no exista o que tu rol en esta
        institución no la incluya.
      </p>
      <Button asChild>
        <Link to="/">Ir al inicio</Link>
      </Button>
    </StatusPage>
  );
}

export function ForbiddenPage() {
  return (
    <StatusPage
      icon={<ShieldX className="size-8" aria-hidden="true" />}
      title="No tienes acceso a esta sección"
    >
      <p className="text-muted-foreground">
        Tu rol en esta institución no incluye esta opción. Si la necesitas, pídela a la
        administración.
      </p>
      <Button asChild>
        <Link to="/">Ir al inicio</Link>
      </Button>
    </StatusPage>
  );
}

/**
 * Opciones del menú cuya pantalla llega en entregas siguientes (3b a 3f). Si el
 * slug no está en el menú del usuario, «no encontrada»: no se revela si existe.
 */
export function ModulePage() {
  const { '*': rest = '' } = useParams();
  const slug = rest.split('/').filter(Boolean).join('.');
  const { data: menu, isPending, fetchStatus } = useMyMenu();
  if (isPending && fetchStatus !== 'idle') return null;
  const node = menu ? findBySlug(menu, slug) : undefined;
  if (!node?.permissions.view) return <NotFoundPage />;
  return (
    <StatusPage icon={<Construction className="size-8" aria-hidden="true" />} title={node.name}>
      <p className="text-muted-foreground">
        Esta sección estará disponible en una próxima versión de Aula360.
      </p>
    </StatusPage>
  );
}

/** Errores inesperados al renderizar una ruta. */
export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <StatusPage
        icon={<TriangleAlert className="size-8" aria-hidden="true" />}
        title="Algo salió mal"
      >
        <p className="text-muted-foreground">
          Recarga la página. Si el problema sigue, avísale a la administración.
        </p>
        <Button
          onClick={() => {
            window.location.reload();
          }}
        >
          Recargar
        </Button>
      </StatusPage>
    </div>
  );
}
