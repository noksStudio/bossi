import { describe, expect, it } from 'vitest';
import { PRESETS, dispatch, slotContributions, usePort, type EventEnvelope } from '@bossi/kernel';
import { createRegistry } from '../src/index.js';
import { ReceivablesPort } from '../src/ports.js';

const registry = createRegistry();

describe('המרשם המלא', () => {
  it('תקין — אין שגיאות אימות', () => {
    const errors = registry.validate().filter((i) => i.level === 'error');
    expect(errors).toEqual([]);
  });
});

describe('הרכבה לדייר', () => {
  it('מוסיפה תלויות חסרות אוטומטית ומדווחת עליהן', () => {
    const c = registry.resolveTenant(['collections']);
    expect(c.enabled).toContain('billing');
    expect(c.autoAdded).toEqual(['billing']);
    // תלות לפני התלוי בה
    expect(c.enabled.indexOf('billing')).toBeLessThan(c.enabled.indexOf('collections'));
  });

  it('דייר מסמכים בלבד לא מקבל שום ניווט של מסחר או כספים', () => {
    const c = registry.resolveTenant([...PRESETS.documents]);
    const hrefs = c.nav.map((n) => n.href);
    expect(hrefs).toContain('/documents');
    expect(hrefs).not.toContain('/catalog');
    expect(hrefs).not.toContain('/billing');
    expect(c.enabled).not.toContain('retainers');
  });

  it('עסק שירותים ועסק B2B הם אותה מערכת בהרכבה אחרת', () => {
    const services = registry.resolveTenant([...PRESETS.services]);
    const commerce = registry.resolveTenant([...PRESETS.commerce]);

    expect(services.enabled).toContain('retainers');
    expect(services.enabled).not.toContain('inventory');
    expect(commerce.enabled).toContain('inventory');
    expect(commerce.enabled).not.toContain('retainers');

    // הליבה משותפת לשניהם — זו הנחת היסוד של ADR-003
    for (const shared of ['documents', 'search', 'billing', 'collections']) {
      expect(services.enabled).toContain(shared);
      expect(commerce.enabled).toContain(shared);
    }
  });

  it('פורט זמין רק אם הספק שלו פעיל', () => {
    const withBilling = registry.resolveTenant(['collections']);
    expect(() => usePort(withBilling, ReceivablesPort)).not.toThrow();

    const docsOnly = registry.resolveTenant([...PRESETS.documents]);
    expect(() => usePort(docsOnly, ReceivablesPort)).toThrow(/אינו זמין/);
  });

  it('זורק על מודול לא מוכר במקום להרכיב מערכת חלקית בשקט', () => {
    expect(() => registry.resolveTenant(['crm'])).toThrow(/לא מוכרים/);
  });
});

describe('תרומות UI מותנות', () => {
  it('"תזכורת + צירוף ראיות" מופיעה רק כששני המודולים פעילים', () => {
    const both = registry.resolveTenant(['collections', 'documents']);
    const ids = slotContributions(both, 'customer.actions').map((s) => s.id);
    expect(ids).toContain('collections.reminder_with_evidence');

    const noDocs = registry.resolveTenant(['collections']);
    const idsNoDocs = slotContributions(noDocs, 'customer.actions').map((s) => s.id);
    expect(idsNoDocs).toContain('collections.send_reminder');
    expect(idsNoDocs).not.toContain('collections.reminder_with_evidence');
  });

  it('תרומות מסודרות לפי order', () => {
    const c = registry.resolveTenant([...PRESETS.full]);
    const widgets = slotContributions(c, 'dashboard.widgets').map((s) => s.order ?? 100);
    expect(widgets).toEqual([...widgets].sort((a, b) => a - b));
  });
});

describe('ניתוב אירועים', () => {
  const envelope = (type: string): EventEnvelope => ({
    type,
    tenantId: 't1',
    occurredAt: new Date(),
    payload: {},
  });
  const deps = {
    tenantId: 't1',
    settingsFor: () => ({}),
    emit: async () => {},
  };

  it('הזמנה מקצה מלאי רק כשמודול המלאי פעיל', async () => {
    const withInv = registry.resolveTenant(['orders', 'inventory']);
    const r1 = await dispatch(withInv, envelope('orders.placed'), deps);
    expect(r1.handled.map((h) => h.handlerId)).toContain('orders.allocate_stock');

    const withoutInv = registry.resolveTenant(['orders']);
    const r2 = await dispatch(withoutInv, envelope('orders.placed'), deps);
    expect(r2.handled.map((h) => h.handlerId)).not.toContain('orders.allocate_stock');
  });

  it('אירוע ללא מאזינים אינו שגיאה', async () => {
    const c = registry.resolveTenant([...PRESETS.documents]);
    const r = await dispatch(c, envelope('billing.invoice_overdue'), deps);
    expect(r.handled).toEqual([]);
    expect(r.failed).toEqual([]);
  });

  it('מטפל שנכשל אינו מפיל את האחרים, והכשל מדווח', async () => {
    const c = registry.resolveTenant(['collections', 'alerts']);
    const routes = c.routes.get('billing.invoice_overdue')!;
    expect(routes.length).toBeGreaterThan(1);
    routes[0]!.handler = { ...routes[0]!.handler, handle: () => { throw new Error('boom'); } };

    const r = await dispatch(c, envelope('billing.invoice_overdue'), deps);
    expect(r.failed).toHaveLength(1);
    expect(r.handled.length).toBe(routes.length - 1);
  });
});
