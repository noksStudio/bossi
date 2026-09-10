import { describe, expect, it } from 'vitest';
import { buildAlerts, countBySeverity, topThree, type AlertInputs } from '../src/index';

const TODAY = new Date('2026-09-15T10:00:00Z');
const iso = (d: number) => new Date(TODAY.getTime() + d * 86_400_000).toISOString().slice(0, 10);

describe('מנוע ההתראות', () => {
  it('רשימה ריקה כשאין קלט — מודול כבוי פשוט לא מעביר נתונים', () => {
    expect(buildAlerts({}, TODAY)).toEqual([]);
  });

  it('צ׳ק שחזר הוא קריטי ודוחק מסמך שפג בעוד חודשיים', () => {
    const alerts = buildAlerts({
      checks: [{
        id: 'c1', customer_id: 'k1', customer_name: 'אבי', check_number: '4471',
        amount: '8700.00', due_on: iso(-3), status: 'bounced', cleared_amount: null,
      }],
      documents: [{
        id: 'd1', title: 'ביטוח', expires_on: iso(55), status: 'filed',
        customer_id: 'k2', customer_name: 'דנה',
      }],
    }, TODAY);

    expect(alerts[0]!.kind).toBe('check_bounced');
    expect(alerts[0]!.severity).toBe('critical');
    expect(alerts[0]!.title).toContain('4471');
    expect(alerts[1]!.severity).toBe('info');
  });

  it('צ׳ק באיחור ארוך מסלים לקריטי', () => {
    const late = buildAlerts({ checks: [check('c1', -20)] }, TODAY)[0]!;
    const fresh = buildAlerts({ checks: [check('c2', -3)] }, TODAY)[0]!;
    expect(late.severity).toBe('critical');
    expect(fresh.severity).toBe('attention');
  });

  it('צ׳ק עתידי אינו מייצר התראה', () => {
    expect(buildAlerts({ checks: [check('c1', 12)] }, TODAY)).toEqual([]);
  });

  it('מסמך שפג כבר הוא קריטי; שפג בעוד שבועיים דורש תשומת לב', () => {
    const expired = buildAlerts({ documents: [doc('d1', -5)] }, TODAY)[0]!;
    const soon = buildAlerts({ documents: [doc('d2', 14)] }, TODAY)[0]!;
    expect(expired.severity).toBe('critical');
    expect(expired.title).toContain('כבר פג');
    expect(soon.severity).toBe('attention');
  });

  it('מסמך שפג בעוד יותר מחודשיים אינו מטריד', () => {
    expect(buildAlerts({ documents: [doc('d1', 90)] }, TODAY)).toEqual([]);
  });

  it('חוזה שחלון ההודעה שלו נסגר הוא קריטי — גם כשהסיום רחוק', () => {
    const a = buildAlerts({
      leases: [{
        id: 'l1', customer_id: 'k1', customer_name: 'רם', property_name: 'הרצל 4',
        ends_on: iso(70), notice_days: 90, status: 'active',
      }],
    }, TODAY)[0]!;
    expect(a.kind).toBe('lease_notice_closed');
    expect(a.severity).toBe('critical');
  });

  it('חוזה רחוק אינו מייצר התראה', () => {
    expect(buildAlerts({
      leases: [{ id: 'l1', customer_id: 'k', customer_name: 'x', property_name: 'y', ends_on: iso(600), notice_days: 90, status: 'active' }],
    }, TODAY)).toEqual([]);
  });

  it('כל התראה נושאת יעד — התראה שאי אפשר ללחוץ עליה היא רעש', () => {
    const alerts = buildAlerts({
      checks: [check('c1', -2)],
      documents: [doc('d1', 5)],
      leases: [{ id: 'l1', customer_id: 'k', customer_name: 'x', property_name: 'y', ends_on: iso(100), notice_days: 90, status: 'active' }],
      quietCustomers: [{ id: 'q1', display_name: 'נשכח', days_quiet: 80 }],
    }, TODAY);
    expect(alerts.length).toBe(4);
    for (const a of alerts) {
      expect(a.href).toMatch(/^\//);
      expect(a.action).toBeTruthy();
    }
  });

  it('בתוך אותה חומרה — הדחוף יותר קודם', () => {
    const alerts = buildAlerts({ documents: [doc('d1', -2), doc('d2', -30)] }, TODAY);
    expect(alerts[0]!.id).toBe('doc-exp-d2'); // פג מזמן
  });

  it('שלושת הדברים אינם כוללים מידע בלבד', () => {
    const alerts = buildAlerts({
      checks: [check('c1', -20), check('c2', -18), check('c3', -16), check('c4', -14)],
      quietCustomers: [{ id: 'q', display_name: 'x', days_quiet: 90 }],
    }, TODAY);
    const top = topThree(alerts);
    expect(top).toHaveLength(3);
    expect(top.every((a) => a.severity !== 'info')).toBe(true);
  });

  it('ספירה לפי חומרה', () => {
    const counts = countBySeverity(buildAlerts({
      checks: [check('c1', -20)],
      documents: [doc('d1', 10), doc('d2', 50)],
    }, TODAY));
    expect(counts).toEqual({ critical: 1, attention: 1, info: 1 });
  });

  it('מסמך שממתין לאישור מופיע גם בלי תוקף', () => {
    const a = buildAlerts({
      documents: [{ id: 'd1', title: 'תעודה', expires_on: null, status: 'needs_review', customer_id: 'k', customer_name: 'x' }],
    }, TODAY)[0]!;
    expect(a.kind).toBe('document_review');
  });
});

function check(id: string, dueOffset: number) {
  return {
    id, customer_id: 'k1', customer_name: 'אבי', check_number: '1',
    amount: '5000.00', due_on: iso(dueOffset), status: 'pending' as const, cleared_amount: null,
  };
}
function doc(id: string, expiresOffset: number) {
  return {
    id, title: 'אישור', expires_on: iso(expiresOffset), status: 'filed',
    customer_id: 'k1', customer_name: 'אבי',
  };
}
