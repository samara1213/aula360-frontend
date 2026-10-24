import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, trackConsole } from '../e2e/checks';

// Flujos por rol contra el backend real (playwright.integration.config.ts).
// Van en orden sobre un mismo escenario: el docente registra la nota, el
// estudiante la ve, el administrador genera el boletín y el estudiante lo
// descarga.

type User = { id: string; email: string; firstName: string; lastName: string };
type Scenario = {
  password: string;
  institution: { id: string; name: string };
  otherInstitution: { id: string; name: string };
  users: Record<'superAdmin' | 'admin' | 'otherAdmin' | 'teacher' | 'student', User>;
  studentId: string;
  courseId: string;
  periodId: string;
  evaluationId: string;
};

const scenarioFile = process.env.BROWSER_E2E_SCENARIO ?? '';
const scenario = () => JSON.parse(readFileSync(scenarioFile, 'utf8')) as Scenario;

async function login(page: Page, user: User) {
  await page.goto('/login');
  await page.getByLabel('Correo o documento').fill(user.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(scenario().password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(
    page.getByRole('button', { name: new RegExp(`Tu cuenta: ${user.firstName}`) }),
  ).toBeVisible();
}

async function logout(page: Page, user: User) {
  await page.getByRole('button', { name: new RegExp(`Tu cuenta: ${user.firstName}`) }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** La próxima pestaña que se abra descarga el PDF (Chromium sin visor). */
function nextPdfTab(page: Page) {
  return new Promise<string>((resolve) => {
    page.context().once('page', (tab) => {
      tab.once('download', (download) => {
        void download.path().then(() => {
          resolve(download.url());
        });
      });
    });
  });
}

test.describe.serial('flujos por rol contra el backend real', () => {
  let consoleMessages: string[] = [];
  test.beforeEach(({ page }) => {
    consoleMessages = trackConsole(page);
  });
  test.afterEach(() => {
    expect(consoleMessages).toEqual([]);
  });

  test('docente: abre su carga, registra la nota y la guarda', async ({ page }) => {
    const { users, evaluationId } = scenario();
    await login(page, users.teacher);
    await page.goto('/evaluations/evaluations');
    await expect(page.getByRole('heading', { name: 'Mis cargas' })).toBeVisible();
    await page
      .getByRole('button', { name: /Matemáticas/ })
      .first()
      .click();
    await page
      .getByRole('link', { name: 'Planilla de notas de Taller de fracciones' })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/evaluations/evaluations/${evaluationId}/scores`));
    const input = page.getByLabel(`Nota de ${users.student.firstName} ${users.student.lastName}`);
    await input.filter({ visible: true }).first().fill('4,5');
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Guardar notas' }).click();
    await expect(page.getByText(/Notas guardadas|guardad/i).first()).toBeVisible();
    await logout(page, users.teacher);
  });

  test('estudiante: ve la nota en «Mis notas»', async ({ page }) => {
    const { users } = scenario();
    await login(page, users.student);
    await page.goto('/evaluations/scores');
    await expect(page.getByText('Matemáticas').first()).toBeVisible();
    await expect(page.getByText('4,5').first()).toBeVisible();
    await expectAccessible(page);
    await logout(page, users.student);
  });

  test('administrador: genera los boletines del curso y descarga el PDF', async ({ page }) => {
    const { users, courseId, periodId } = scenario();
    await login(page, users.admin);
    await page.goto(`/reports/report-cards?course=${courseId}&period=${periodId}`);
    await page.getByRole('button', { name: 'Generar boletines del curso' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Generar boletines' }).click();
    const summary = page.getByRole('region', { name: 'Resultado de la generación' });
    await expect(summary).toBeVisible({ timeout: 60_000 });
    const name = `${users.student.firstName} ${users.student.lastName}`;
    const table = page.getByRole('table');
    await expect(table.getByText(name)).toBeVisible();
    await expectAccessible(page);

    // El PDF real (Chromium del backend), por el backend y abierto como blob.
    const downloaded = nextPdfTab(page);
    await table.getByRole('button', { name: `Acciones del boletín de ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Descargar' }).click();
    expect(await downloaded).toMatch(/^blob:/);
    await logout(page, users.admin);
  });

  test('estudiante: descarga su boletín desde «Mis boletines»', async ({ page }) => {
    const { users } = scenario();
    await login(page, users.student);
    await page.goto('/reports/report-cards');
    const list = page.getByRole('list', { name: 'Mis boletines' });
    await expect(list).toBeVisible();
    const downloaded = nextPdfTab(page);
    await list
      .getByRole('button', { name: /Descargar PDF/ })
      .first()
      .click();
    expect(await downloaded).toMatch(/^blob:/);
    await expectAccessible(page);
    await logout(page, users.student);
  });

  test('SUPER_ADMIN: vista previa de la plantilla del sistema de la institución', async ({
    page,
  }) => {
    const { users, institution } = scenario();
    await login(page, users.superAdmin);
    await page.goto(`/admin/institutions/${institution.id}?tab=templates`);
    await expect(page.getByRole('list', { name: 'Plantillas' })).toBeVisible();
    await expectAccessible(page);
    const downloaded = nextPdfTab(page);
    await page.getByRole('button', { name: 'Vista previa de Plantilla del sistema' }).click();
    expect(await downloaded).toMatch(/^blob:/);
    await logout(page, users.superAdmin);
  });

  test('aislamiento: el administrador de otra institución no ve al estudiante', async ({
    page,
  }) => {
    const { users, studentId } = scenario();
    await login(page, users.otherAdmin);
    await page.goto(`/people/students/${studentId}`);
    await expect(page.getByText('No encontramos esta página')).toBeVisible();
    await logout(page, users.otherAdmin);
  });

  test('sin sesión (cookies borradas), vuelve al login y después a la página', async ({
    page,
    context,
  }) => {
    const { users } = scenario();
    await login(page, users.admin);
    await context.clearCookies();
    await page.goto('/reports/report-cards');
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel('Correo o documento').fill(users.admin.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(scenario().password);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/reports\/report-cards/);
  });
});
