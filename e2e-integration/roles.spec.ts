import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, trackConsole } from '../e2e/checks';

// Flujos por rol contra el backend real (playwright.integration.config.ts).
// Van en orden sobre un mismo escenario: el docente registra la nota, el
// estudiante la ve, el administrador genera el boletín y el estudiante lo
// descarga; después, el administrador invita a un docente de otra institución,
// este acepta y el administrador le quita el acceso.

type User = { id: string; email: string; firstName: string; lastName: string };
type Scenario = {
  password: string;
  institution: { id: string; name: string };
  otherInstitution: { id: string; name: string };
  users: Record<'superAdmin' | 'admin' | 'otherAdmin' | 'teacher' | 'student' | 'shared', User>;
  sharedDocument: { documentType: string; documentNumber: string };
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

  test('administrador: invita a un docente que tiene cuenta en otra institución', async ({
    page,
  }) => {
    const { users, sharedDocument } = scenario();
    await login(page, users.admin);
    await page.goto('/people/teachers');
    await page.getByRole('button', { name: 'Nuevo docente' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo docente' });
    await dialog.getByLabel('Tipo de documento').selectOption(sharedDocument.documentType);
    await dialog.getByLabel('Número de documento').fill(sharedDocument.documentNumber);
    await dialog.getByLabel('Nombres').fill('Carlos');
    await dialog.getByLabel('Apellidos').fill('Compartido');
    await dialog.getByLabel('Sede').selectOption({ index: 1 }); // la sede del escenario
    await dialog.getByRole('button', { name: 'Crear docente' }).click();

    // El documento ya tiene cuenta (en la otra institución): se busca y se invita.
    const panel = dialog.getByRole('region', { name: 'Cuenta existente' });
    await panel.getByRole('button', { name: 'Buscar su cuenta' }).click();
    await expect(panel.getByText('Carlos C.')).toBeVisible();
    await expectAccessible(page);
    await panel.getByRole('button', { name: 'Enviar invitación' }).click();
    await expect(dialog).toBeHidden();
    const pending = page.getByRole('list', { name: 'Invitaciones pendientes' });
    await expect(pending.getByText('Carlos C.', { exact: true })).toBeVisible();
    await expectAccessible(page);
    await logout(page, users.admin);
  });

  test('docente invitado: acepta la invitación y entra a la institución', async ({ page }) => {
    const { users, institution } = scenario();
    await login(page, users.shared);
    const list = page.getByRole('list', { name: 'Invitaciones' });
    await expect(list.getByText(institution.name, { exact: true })).toBeVisible();
    await expectAccessible(page);
    await list
      .getByRole('button', { name: `Aceptar la invitación de ${institution.name}` })
      .click();
    await expect(page.getByText(`Ya perteneces a ${institution.name}.`)).toBeVisible();
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(
      page.getByRole('button', { name: new RegExp(`Institución: ${institution.name}`) }),
    ).toBeVisible();
    await logout(page, users.shared);
  });

  test('administrador: ve su ficha en solo lectura y le quita el acceso', async ({ page }) => {
    const { users } = scenario();
    await login(page, users.admin);
    await page.goto('/people/teachers');
    await expect(page.getByRole('list', { name: 'Invitaciones pendientes' })).toBeHidden();
    await page
      .getByRole('link', { name: /Carlos Compartido/ })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: 'Carlos Compartido', level: 1 })).toBeVisible();
    await expect(page.getByLabel('Nombres')).toHaveAttribute('readonly', '');

    await page.getByRole('button', { name: 'Quitar acceso en esta institución' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Quitar acceso' }).click();
    await expect(page).toHaveURL(/\/people\/teachers$/);
    await expect(
      page.getByText('Carlos Compartido ya no tiene acceso a esta institución.'),
    ).toBeVisible();
    await logout(page, users.admin);
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
