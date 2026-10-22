import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, trackConsole } from './checks';
import { COURSE_ID, mockApi, SESSION, setTheme, STUDENT_ID, THEMES, VIEWPORTS } from './fixtures';

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`cursos, ${viewport.name}, tema ${theme}`, () => {
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

      test('cursos y su ficha', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto('/academic/courses');
        await expect(page.getByRole('heading', { name: 'Cursos', exact: true })).toBeVisible();
        await expect(
          page.getByRole('link', { name: 'Transición A' }).filter({ visible: true }),
        ).toBeVisible();
        await check(page, info, 'cursos');

        await page.getByRole('button', { name: 'Nuevo curso' }).click();
        await expect(page.getByRole('dialog', { name: 'Nuevo curso' })).toBeVisible();
        await expect(page.getByLabel('Año lectivo', { exact: true }).last()).toBeVisible();
        await expectAccessible(page);
        await page.keyboard.press('Escape');

        await page.goto(`/academic/courses/${COURSE_ID}`);
        await expect(page.getByRole('heading', { name: 'Curso 601' })).toBeVisible();
        await expect(page.getByText('Lengua castellana').filter({ visible: true })).toBeVisible();
        await check(page, info, 'curso-carga');

        await page.getByRole('tab', { name: 'Estudiantes' }).click();
        await expect(
          page.getByText('Juan José Martínez Pérez').filter({ visible: true }),
        ).toBeVisible();
        await check(page, info, 'curso-estudiantes');
      });

      test('carga académica, matrículas y diálogos', async ({ page }, info) => {
        await setTheme(page, theme);
        await mockApi(page, SESSION);
        await page.goto('/academic/teacher-assignments');
        await expect(page.getByRole('heading', { name: 'Carga académica' })).toBeVisible();
        await check(page, info, 'carga');

        await page.getByRole('button', { name: 'Asignar materia' }).click();
        await expect(page.getByRole('dialog', { name: 'Asignar materia' })).toBeVisible();
        await expectAccessible(page);
        await page.screenshot({ path: info.outputPath(`asignar-${viewport.name}-${theme}.png`) });
        await page.keyboard.press('Escape');

        await page.goto('/academic/enrollments');
        await expect(page.getByRole('heading', { name: 'Matrículas' })).toBeVisible();
        await expect(page.getByText('Graduado').filter({ visible: true })).toBeVisible();
        await check(page, info, 'matriculas');

        await page.getByRole('button', { name: 'Matricular' }).click();
        await expect(page.getByRole('dialog', { name: 'Matricular' })).toBeVisible();
        await expectAccessible(page);
        await page.screenshot({
          path: info.outputPath(`matricular-${viewport.name}-${theme}.png`),
        });
        await page.keyboard.press('Escape');

        await page.goto(`/people/students/${STUDENT_ID}`);
        await expect(page.getByRole('region', { name: 'Matrículas' })).toBeVisible();
        await check(page, info, 'estudiante-matriculas');
      });
    });
  }
}
