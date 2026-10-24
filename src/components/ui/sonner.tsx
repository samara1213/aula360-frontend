import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/theme/theme-context';

export function Toaster() {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      position="top-center"
      closeButton
      toastOptions={{
        classNames: {
          // Fondo opaco por tipo y borde izquierdo marcado: el blanco de las
          // tarjetas no se distinguía del fondo de la página. Colores solo en
          // las claves por tipo: con !important en `toast` y en el tipo, gana el
          // que Tailwind emite después, no el más específico.
          toast: 'rounded-xl! border-l-4! font-sans! shadow-lg!',
          default: 'bg-popover! text-popover-foreground! border-rule! border-l-primary!',
          description: 'text-inherit! opacity-90',
          closeButton: 'bg-card! text-foreground! border-rule!',
          info: 'bg-notice-info! text-notice-info-foreground! border-notice-info-border/50! border-l-notice-info-border!',
          success:
            'bg-notice-success! text-notice-success-foreground! border-notice-success-border/50! border-l-notice-success-border!',
          warning:
            'bg-notice-warning! text-notice-warning-foreground! border-notice-warning-border/50! border-l-notice-warning-border!',
          error:
            'bg-notice-error! text-notice-error-foreground! border-notice-error-border/50! border-l-notice-error-border!',
        },
      }}
    />
  );
}
