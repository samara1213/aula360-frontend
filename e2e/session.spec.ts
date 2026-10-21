import { expect, test } from '@playwright/test';
import { MENU, SESSION } from './fixtures';

test('dos pestañas con la sesión vencida renuevan una sola vez (A1)', async ({ context }) => {
  let refreshes = 0;
  let renewed = false;
  await context.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      const json = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (path === '/api/auth/refresh-token') {
        refreshes++;
        await new Promise((r) => setTimeout(r, 300));
        renewed = true;
        return route.fulfill({ status: 204 });
      }
      if (!renewed) return json({ statusCode: 401, message: 'No autorizado' }, 401);
      if (path === '/api/auth/me') return json(SESSION);
      if (path === '/api/menu-options/my-menu') return json(MENU);
      return json({ statusCode: 404, message: 'No encontrado' }, 404);
    },
  );

  const [first, second] = [await context.newPage(), await context.newPage()];
  await Promise.all([first.goto('/'), second.goto('/')]);
  await expect(first.getByRole('heading', { name: /Ana María/ })).toBeVisible();
  await expect(second.getByRole('heading', { name: /Ana María/ })).toBeVisible();
  expect(refreshes).toBe(1);
});
