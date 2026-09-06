import { describe, expect, it } from 'vitest';
import { PLANS, PLAN_ORDER, evaluateUsage, smallestPlanFor, utilisation } from '../src/plans';
import { createRegistry } from '../src/index';

const registry = createRegistry();

describe('חבילות', () => {
  it('כל חבילה מרכיבה מערכת תקינה', () => {
    for (const id of PLAN_ORDER) {
      const c = registry.resolveTenant([...PLANS[id].modules]);
      expect(c.autoAdded, `${id} חסרות לו תלויות`).toEqual([]);
    }
  });

  it('החבילות מקוננות — כל חבילה מכילה את הקודמת', () => {
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      const prev = PLANS[PLAN_ORDER[i - 1]!].modules;
      const curr = PLANS[PLAN_ORDER[i]!].modules;
      expect(prev.every((m) => curr.includes(m))).toBe(true);
    }
  });

  it('מכסות עולות עם החבילה', () => {
    expect(PLANS.starter.quotas.storage_gb.limit!).toBeLessThan(PLANS.pro.quotas.storage_gb.limit!);
    expect(PLANS.pro.quotas.storage_gb.limit!).toBeLessThan(PLANS.mega.quotas.storage_gb.limit!);
  });

  it('כל מודול קיים שייך לפחות לחבילה אחת', () => {
    const covered = new Set(PLAN_ORDER.flatMap((id) => PLANS[id].modules));
    for (const m of registry.all()) expect(covered.has(m.id), `${m.id} לא בשום חבילה`).toBe(true);
  });
});

describe('evaluateUsage', () => {
  it('צריכה בתוך המכסה אינה מייצרת חריגה', () => {
    const r = evaluateUsage(PLANS.pro, { storage_gb: 100, emails_sent: 4_000 });
    expect(r.breaches).toEqual([]);
    expect(r.totalOverage).toBe(0);
  });

  it('מחשב חיוב חריגה על מכסה רכה', () => {
    const r = evaluateUsage(PLANS.starter, { storage_gb: 25 }); // 5GB × 9₪
    expect(r.totalOverage).toBe(45);
    expect(r.blocked).toEqual([]);
  });

  it('חוסם על מכסה קשיחה במקום לחייב', () => {
    const r = evaluateUsage(PLANS.starter, { whatsapp_messages: 10 });
    expect(r.blocked).toContain('whatsapp_messages');
    expect(r.totalOverage).toBe(0);
  });

  it('מצטבר על פני כמה מדדים', () => {
    const r = evaluateUsage(PLANS.starter, { storage_gb: 22, emails_sent: 1_200 });
    expect(r.breaches).toHaveLength(2);
    expect(r.totalOverage).toBe(28); // 2×9 + 200×0.05
  });

  it('מכסה ללא הגבלה לא נחצית לעולם', () => {
    expect(evaluateUsage(PLANS.mega, { active_customers: 99_999 }).breaches).toEqual([]);
  });
});

describe('עזרים', () => {
  it('utilisation מחזיר null כשאין מכסה', () => {
    expect(utilisation(PLANS.mega, 'active_customers', 500)).toBeNull();
    expect(utilisation(PLANS.pro, 'storage_gb', 75)).toBe(0.5);
  });

  it('smallestPlanFor מוצא את החבילה הזולה ביותר שמכסה את הצורך', () => {
    expect(smallestPlanFor(['documents'])!.id).toBe('starter');
    expect(smallestPlanFor(['retainers'])!.id).toBe('pro');
    expect(smallestPlanFor(['inventory'])!.id).toBe('mega');
  });
});
