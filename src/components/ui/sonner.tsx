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
          toast: 'rounded-xl! border-border! bg-popover! text-popover-foreground! font-sans!',
        },
      }}
    />
  );
}
