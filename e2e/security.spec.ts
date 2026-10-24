import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, trackConsole } from './checks';
import {
  INSTITUTION_ID,
  mockApi,
  ROLE_ID,
  SESSION,
  setTheme,
  SUPER_ADMIN_SESSION,
  THEMES,
  USER_ID,
  VIEWPORTS,
} from './fixtures';

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`${viewport.name}, tema ${theme}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      let consoleMessages: string[] = [];
      test.beforeEach(({ page }) => {
        consoleMessages = trackConsole(page);
      });
      test.afterEach(() => {
        expect(consoleMessages).toEqual([]);
      });

      /** Revisa la página y guarda su captura completa. */
      async function check(page: Page, info: TestInfo, name: string) {
        await expectNoHorizontalScroll(page);
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`${name}-${viewport.name}-${theme}.png`),
          fullPage: true,
        });
      }

      test('roles y matriz de permisos', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto('/security/roles');
        await expect(page.getByRole('heading', { name: 'Roles', exact: true })).toBeVisible();
        await expect(
          page.getByText('Administrador de la institución').filter({ visible: true }),
        ).toBeVisible();
        await check(page, info, 'roles');

        await page.goto(`/security/roles/${ROLE_ID}`);
        await expect(page.getByRole('heading', { name: 'Coordinación académica' })).toBeVisible();
        await expect(page.getByRole('checkbox', { name: 'Crear: Usuarios' })).toBeChecked();
        await check(page, info, 'rol-permisos');
      });

      test('usuarios, ficha y alta', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto('/security/users');
        await expect(page.getByRole('heading', { name: 'Usuarios', exact: true })).toBeVisible();
        await expect(page.getByText('Luz Marina Ocampo').filter({ visible: true })).toBeVisible();
        await check(page, info, 'usuarios');

        await page.getByRole('button', { name: 'Nuevo usuario' }).click();
        await expect(page.getByRole('dialog', { name: 'Nuevo usuario' })).toBeVisible();
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`usuario-nuevo-${viewport.name}-${theme}.png`),
        });
        await page.keyboard.press('Escape');

        await page.goto(`/security/users/${USER_ID}`);
        await expect(page.getByRole('heading', { name: 'Carlos Andrés Ruiz Mejía' })).toBeVisible();
        await check(page, info, 'usuario-ficha');
      });

      test('menús (solo lectura)', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto('/security/menu-options');
        await expect(page.getByRole('heading', { name: 'Menús', exact: true })).toBeVisible();
        await expect(page.getByRole('main').getByText('Grados')).toBeVisible();
        await check(page, info, 'menus');
      });

      test('SUPER_ADMIN: opciones de menú, roles globales y usuarios de una institución', async ({
        page,
      }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SUPER_ADMIN_SESSION);
        await page.goto('/admin/menu-options');
        await expect(page.getByRole('heading', { name: 'Opciones de menú' })).toBeVisible();
        await check(page, info, 'admin-menus');

        await page.goto('/admin/global-roles');
        await expect(page.getByRole('heading', { name: 'Roles globales' })).toBeVisible();
        await check(page, info, 'admin-roles-globales');

        await page.goto(`/admin/institutions/${INSTITUTION_ID}?tab=users`);
        await expect(page.getByRole('tab', { name: 'Usuarios' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await expect(page.getByText('Luz Marina Ocampo').filter({ visible: true })).toBeVisible();
        await check(page, info, 'admin-institucion-usuarios');
      });

      test('SUPER_ADMIN: plantillas del boletín de una institución', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SUPER_ADMIN_SESSION);
        await page.goto(`/admin/institutions/${INSTITUTION_ID}?tab=templates`);
        await expect(page.getByRole('tab', { name: 'Boletín' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await expect(page.getByRole('list', { name: 'Plantillas' })).toBeVisible();
        await page.getByText('Variables disponibles').click();
        await check(page, info, 'admin-institucion-plantillas');

        // El navegador envía el archivo con su nombre: el backend exige .html.
        const uploaded = new Promise<string>((resolve) => {
          void page.route('**/api/institutions/*/report-card-templates', (route) => {
            if (route.request().method() !== 'POST') return route.fallback();
            resolve(route.request().postData() ?? '');
            return route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({
                id: 'a3b4c5d6-e7f8-4a9b-8c1d-2e3f4a5b6c7d',
                name: 'Nueva',
                description: null,
                isActive: false,
                contentSha256: 'c'.repeat(64),
                createdBy: null,
                createdAt: '2026-10-23T15:00:00Z',
              }),
            });
          });
        });
        await page.getByRole('button', { name: 'Subir plantilla' }).click();
        const dialog = page.getByRole('dialog', { name: 'Subir plantilla' });
        await dialog.locator('input[type="file"]').setInputFiles({
          name: 'nueva.html',
          mimeType: 'text/html',
          buffer: Buffer.from('<p>{{student.firstName}}</p>'),
        });
        await dialog.getByLabel('Nombre').fill('Nueva');
        await expectAccessible(page);
        await dialog.getByRole('button', { name: 'Subir plantilla' }).click();
        const body = await uploaded;
        expect(body).toContain('filename="nueva.html"');
        expect(body).toContain('name="name"');
        await expect(page.getByText(/«Nueva» subida/)).toBeVisible();
      });

      test('SUPER_ADMIN: sedes de una institución', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SUPER_ADMIN_SESSION);
        await page.goto(`/admin/institutions/${INSTITUTION_ID}?tab=campuses`);
        await expect(page.getByRole('tab', { name: 'Sedes' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await expect(
          page.getByText('Sede Norte — Primaria').filter({ visible: true }),
        ).toBeVisible();
        await check(page, info, 'admin-institucion-sedes');
      });
    });
  }
}
