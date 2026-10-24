import { describe, expect, it } from 'vitest';
import { nginxHeaders, securityHeaders } from './security-headers.mjs';

// Fuente única de las cabeceras de producción: valores de configuración que
// romperían la CSP o el archivo de nginx fallan al generarlas (B4 de la entrega C).

const HTML = '<html><head><script>document.documentElement.dataset.x = "1"</script></head></html>';

describe('securityHeaders', () => {
  it('CSP con Trusted Types y los informes en /api/csp-reports por defecto', () => {
    const headers = securityHeaders({ html: HTML });
    const csp = headers['Content-Security-Policy'] ?? '';
    expect(csp).toContain("require-trusted-types-for 'script'; trusted-types 'none'");
    expect(csp).toContain('report-to csp; report-uri /api/csp-reports');
    expect(headers['Reporting-Endpoints']).toBe('csp="/api/csp-reports"');
  });

  it('acepta orígenes https, http en localhost y una URL https de informes', () => {
    const headers = securityHeaders({
      html: HTML,
      imgOrigins: ['https://abc.supabase.co'],
      connectOrigins: ['http://localhost:3000'],
      reportUrl: 'https://api.colegio.co/api/csp-reports',
    });
    expect(headers['Content-Security-Policy']).toContain("img-src 'self' https://abc.supabase.co");
    expect(headers['Reporting-Endpoints']).toBe('csp="https://api.colegio.co/api/csp-reports"');
  });

  it.each([
    ['https://api.x/csp; sandbox', /caracteres no permitidos/],
    ['https://api.x/csp,otra', /caracteres no permitidos/],
    ['https://api.x/"csp', /caracteres no permitidos/],
    ['https://api.x/$host', /caracteres no permitidos/],
    ['http://api.colegio.co/csp', /https/],
    ['javascript:alert(1)', /https/],
    ['//evil.example/csp', /no es una ruta válida/],
    ['/api/csp reports', /no es una ruta válida/],
  ])('rechaza CSP_REPORT_URL «%s»', (reportUrl, message) => {
    expect(() => securityHeaders({ html: HTML, reportUrl })).toThrow(message);
  });

  it.each([
    'https://abc.supabase.co/storage',
    'https://abc.supabase.co;',
    'http://abc.supabase.co',
    'abc.supabase.co',
  ])('rechaza el origen «%s»', (origin) => {
    expect(() => securityHeaders({ html: HTML, imgOrigins: [origin] })).toThrow(/CSP_IMG_ORIGINS/);
  });
});

describe('nginxHeaders', () => {
  it('escapa las comillas dobles', () => {
    expect(nginxHeaders({ 'Reporting-Endpoints': 'csp="/api/csp-reports"' })).toBe(
      'add_header Reporting-Endpoints "csp=\\"/api/csp-reports\\"" always;',
    );
  });

  it.each(['a $host', 'a \\ b', 'a\nb'])('rechaza valores que nginx interpretaría: %j', (value) => {
    expect(() => nginxHeaders({ X: value })).toThrow(/nginx/);
  });
});
