import type { MenuNode } from '@/api/types';
import { findBySlug, slugToPath } from './menu';

const perms = { view: true, create: false, update: false, delete: false };
const node = (slug: string, children: MenuNode[] = []): MenuNode => ({
  id: slug,
  name: slug,
  slug,
  icon: null,
  displayOrder: 0,
  permissions: perms,
  institutionWide: perms,
  children,
});

describe('menú', () => {
  it('convierte el slug en ruta', () => {
    expect(slugToPath('academic.performance-levels')).toBe('/academic/performance-levels');
  });

  it('encuentra opciones en cualquier nivel (Padre → Hijo → Nieto)', () => {
    const tree = [node('a', [node('a.b', [node('a.b.c')])]), node('d')];
    expect(findBySlug(tree, 'a.b.c')?.slug).toBe('a.b.c');
    expect(findBySlug(tree, 'x')).toBeUndefined();
  });
});
