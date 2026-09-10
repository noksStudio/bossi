import { describe, expect, it } from 'vitest';
import { burn, effectiveRate, renewalSignal, availableToPromise, orderGate, orderTotals, stockStatus } from '../src/index';

const PERIOD = { starts_on: '2026-09-01', ends_on: '2026-09-30', quota_amount: '40.00', status: 'open' };
const MID = new Date('2026-09-15T10:00:00');   // ~47% מהתקופה

describe('שחיקת ריטיינר', () => {
  it('צריכה בקצב אינה מדליקה נורה', () => {
    const b = burn(PERIOD, 19, MID);
    expect(b.status).toBe('healthy');
    expect(b.remaining).toBe(21);
  });

  it('תקופה בלי צריכה אינה "בקצב" אלא ריקה', () => {
    expect(burn(PERIOD, 0, MID).status).toBe('idle');
  });

  it('חריגה שכבר קרתה מדווחת כחריגה', () => {
    expect(burn(PERIOD, 44, MID).status).toBe('overrun');
  });

  it('חריגה נחזית לפני שהיא קורית', () => {
    const b = burn(PERIOD, 32, MID);
    expect(b.status).toBe('projected_overrun');
    expect(b.projected).toBeGreaterThan(40);
  });

  it('יום עמוס בודד אינו מדליק אזהרה', () => {
    // 21 מתוך 40 באמצע החודש — מהיר ב-9% מהקצב, בתוך הסבילות.
    expect(burn(PERIOD, 21, MID).status).toBe('healthy');
  });

  it('קצב מהיר בעקביות כן מדליק אזהרה', () => {
    expect(burn(PERIOD, 25, MID).status).toBe('watch');
  });

  it('התקדמות התקופה נחתכת בקצוות', () => {
    expect(burn(PERIOD, 10, new Date('2026-10-20T10:00:00')).elapsed).toBe(1);
    expect(burn(PERIOD, 10, new Date('2026-08-01T10:00:00')).elapsed).toBe(0);
  });
});

describe('תעריף שעה אפקטיבי', () => {
  it('8,000 ₪ ב-60 שעות הם 133.33 ₪ לשעה', () => {
    expect(effectiveRate('8000.00', 60)).toBe(13_333);
  });

  it('בלי צריכה אין תעריף — ולא אינסוף', () => {
    expect(effectiveRate('8000.00', 0)).toBeNull();
  });
});

describe('אות חידוש', () => {
  const today = new Date('2026-09-10T09:00:00');

  it('מועד ההודעה מתקרב — לא תאריך הסיום', () => {
    const s = renewalSignal({ starts_on: '2026-01-01', ends_on: '2026-10-15', notice_days: 30 }, today);
    expect(s.kind).toBe('notice_due');
  });

  it('חלון שנסגר מדווח בנפרד', () => {
    const s = renewalSignal({ starts_on: '2025-01-01', ends_on: '2026-09-20', notice_days: 30 }, today);
    expect(s.kind).toBe('notice_passed');
  });

  it('מחיר שלא זז שנתיים הוא אות בפני עצמו', () => {
    const s = renewalSignal({ starts_on: '2023-01-01', notice_days: 30, price_updated_on: '2024-01-01' }, today);
    expect(s.kind).toBe('price_stale');
  });

  it('ריטיינר צעיר עם מחיר טרי שקט', () => {
    const s = renewalSignal({ starts_on: '2026-06-01', notice_days: 30 }, today);
    expect(s.kind).toBe('none');
  });
});

describe('מלאי זמין להבטחה', () => {
  it('מה שהוקצה כבר אינו זמין', () => {
    expect(availableToPromise({ on_hand: '100', allocated: '30', reorder_point: '0' })).toBe(70);
  });

  it('מלאי במחסן שכולו מוקצה נחשב אזל', () => {
    expect(stockStatus({ on_hand: '40', allocated: '40', reorder_point: '10' })).toBe('out');
  });

  it('מתחת לסף ההזמנה מחדש', () => {
    expect(stockStatus({ on_hand: '12', allocated: '4', reorder_point: '10' })).toBe('critical');
    expect(stockStatus({ on_hand: '18', allocated: '4', reorder_point: '10' })).toBe('low');
    expect(stockStatus({ on_hand: '90', allocated: '4', reorder_point: '10' })).toBe('ok');
  });
});

describe('סכומי הזמנה ושער אישור', () => {
  it('כל שורה מעוגלת לפני הסיכום', () => {
    const t = orderTotals([{ quantity: 3, unit_price: '33.33' }, { quantity: 2, unit_price: '10.005' }]);
    expect(t.net).toBe(9_999 + 2_000);
    expect(t.gross).toBe(t.net + t.vat);
    expect(t.units).toBe(5);
  });

  it('חריגה ממסגרת אשראי עוצרת לפני כל דבר אחר', () => {
    const g = orderGate({ orderGross: 500_000, openBalance: 800_000, overdueBalance: 300_000, creditLimit: 1_000_000 });
    expect(g.gate).toBe('hold_credit');
  });

  it('חוב באיחור עוצר גם בלי מסגרת', () => {
    const g = orderGate({ orderGross: 100_000, openBalance: 300_000, overdueBalance: 300_000, creditLimit: null });
    expect(g.gate).toBe('hold_overdue');
  });

  it('חוסר מלאי הוא העצירה האחרונה', () => {
    const g = orderGate({ orderGross: 100_000, openBalance: 0, overdueBalance: 0, linesShort: 2 });
    expect(g.gate).toBe('hold_stock');
  });

  it('לקוח נקי עם מלאי — עובר', () => {
    const g = orderGate({ orderGross: 100_000, openBalance: 200_000, overdueBalance: 0, creditLimit: 5_000_000 });
    expect(g.gate).toBe('approve');
  });
});
