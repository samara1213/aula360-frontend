import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SessionBridge } from '@/auth/session-bridge';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/theme/theme-provider';

export function Providers({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionBridge />
        {children}
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
