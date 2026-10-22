import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}

/** Sin desplazamiento horizontal; si lo hay, nombra los elementos que se salen. */
export async function expectNoHorizontalScroll(page: Page) {
  const offenders = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= width) return [];
    return Array.from(document.querySelectorAll('body *'))
      .filter((el) => el.getBoundingClientRect().right > width + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').slice(0, 80)}`);
  });
  expect(offenders).toEqual([]);
}

/**
 * Errores y advertencias de la consola del navegador durante la prueba. No
 * cuenta el registro de red del navegador («Failed to load resource»): un 401
 * sin sesión es una respuesta esperada de la API.
 */
export function trackConsole(page: Page) {
  const messages: string[] = [];
  page.on('console', (message) => {
    const isNetworkLog = message.text().startsWith('Failed to load resource');
    if ((message.type() === 'error' || message.type() === 'warning') && !isNetworkLog) {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    messages.push(`pageerror: ${error.message}`);
  });
  return messages;
}
