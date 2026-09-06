import { describe, expect, it } from 'vitest';
import { DependencyError, expandRequirements, topoSort } from '../src/graph.js';

const deps: Record<string, string[]> = {
  billing: [],
  collections: ['billing'],
  retainers: ['billing'],
  catalog: [],
  inventory: ['catalog'],
  orders: ['catalog', 'billing'],
};
const depsOf = (id: string) => deps[id] ?? [];

describe('topoSort', () => {
  it('מציב תלות לפני התלוי בה', () => {
    const order = topoSort(['orders', 'collections', 'billing', 'catalog'], depsOf);
    expect(order.indexOf('billing')).toBeLessThan(order.indexOf('collections'));
    expect(order.indexOf('billing')).toBeLessThan(order.indexOf('orders'));
    expect(order.indexOf('catalog')).toBeLessThan(order.indexOf('orders'));
  });

  it('מתעלם מתלות שאינה בקבוצה', () => {
    expect(topoSort(['collections'], depsOf)).toEqual(['collections']);
  });

  it('זורק על מעגל ומדווח את המסלול', () => {
    const cyclic = (id: string) => ({ a: ['b'], b: ['c'], c: ['a'] })[id] ?? [];
    try {
      topoSort(['a', 'b', 'c'], cyclic);
      expect.unreachable('היה אמור לזרוק');
    } catch (e) {
      expect(e).toBeInstanceOf(DependencyError);
      expect((e as DependencyError).details['cycle']).toContain('a');
    }
  });
});

describe('expandRequirements', () => {
  const known = (id: string) => id in deps;

  it('מוסיף תלויות חסרות ומדווח מה נוסף', () => {
    const r = expandRequirements(['collections'], depsOf, known);
    expect(r.resolved.sort()).toEqual(['billing', 'collections']);
    expect(r.added).toEqual(['billing']);
  });

  it('סוגר תלות טרנזיטיבית', () => {
    const chain = (id: string) => ({ c: ['b'], b: ['a'], a: [] })[id] ?? [];
    const r = expandRequirements(['c'], chain, (id) => ['a', 'b', 'c'].includes(id));
    expect(r.resolved.sort()).toEqual(['a', 'b', 'c']);
  });

  it('מדווח מודולים לא מוכרים במקום להתעלם', () => {
    const r = expandRequirements(['ghost'], depsOf, known);
    expect(r.missing).toEqual(['ghost']);
  });
});
