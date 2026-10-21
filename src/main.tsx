import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { createQueryClient } from '@/api/query-client';
import { Providers } from './providers';
import { createRouter } from './router';
import './index.css';

const queryClient = createQueryClient();
const router = createRouter();

const root = document.getElementById('root');
if (!root) throw new Error('Falta el elemento #root');

createRoot(root).render(
  <StrictMode>
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
