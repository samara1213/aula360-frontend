import { CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandMark } from './brand';

export function FullPageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background" role="status">
      <div className="flex flex-col items-center gap-4">
        <BrandMark className="size-12 animate-pulse" />
        <span className="sr-only">Cargando…</span>
      </div>
    </div>
  );
}

export function FullPageError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <CloudOff className="size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-extrabold tracking-tight">No pudimos conectarnos</h1>
        <p className="text-muted-foreground">
          Revisa tu conexión a internet. Si el problema sigue, el servidor puede estar en
          mantenimiento.
        </p>
        <Button onClick={onRetry}>Intentar de nuevo</Button>
      </div>
    </div>
  );
}
