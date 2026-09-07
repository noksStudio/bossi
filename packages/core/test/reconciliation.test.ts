import { describe, expect, it } from 'vitest';
import {
  displayStatus, formatILS, monthWindow, needsAttention, reconcile,
  shiftMonth, toAgorot, toShekels, type CheckLike,
} from '../src/index';

const TODAY = new Date('2026-09-15T10:00:00Z');
const check = (o: Partial<CheckLike> & { id: string }): CheckLike => ({
  amount: '2200.00', due_on: '2026-09-10', status: 'pending', cleared_amount: null, ...o,
});

describe('כסף', () => {
  it('ממיר בלי לאבד אגורות', () => {
    expect(toAgorot('2200.00')).toBe(220000);
    expect(toAgorot('2200.5')).toBe(220050);
    expect(toAgorot('0.07')).toBe(7);
    expect(toAgorot(null)).toBe(0);
  });

  it('שומר על דיוק במקום שבו float נכשל', () => {
    // 0.1 + 0.2 !== 0.3 בנקודה צפה
    expect(toAgorot('0.1') + toAgorot('0.2')).toBe(toAgorot('0.3'));
  });

  it('הלוך ושוב', () => {
    expect(toShekels(toAgorot('1234.56'))).toBe('1234.56');
    expect(toShekels(toAgorot('-45.10'))).toBe('-45.10');
  });

  it('מעצב לעברית', () => {
    expect(formatILS(220000)).toBe('2,200');
  });
});

describe('מצב לתצוגה', () => {
  it('צ׳ק שעבר תאריך ולא סומן הוא באיחור — זה הפריט שחייב לצוף', () => {
    expect(displayStatus(check({ id: 'a', due_on: '2026-09-10' }), TODAY)).toBe('overdue');
  });

  it('מגיע היום', () => {
    expect(displayStatus(check({ id: 'a', due_on: '2026-09-15' }), TODAY)).toBe('due_today');
  });

  it('עתידי', () => {
    expect(displayStatus(check({ id: 'a', due_on: '2026-10-10' }), TODAY)).toBe('upcoming');
  });

  it('צ׳ק שסומן אינו באיחור גם אם התאריך עבר', () => {
    expect(displayStatus(check({ id: 'a', due_on: '2026-08-01', status: 'cleared' }), TODAY)).toBe('cleared');
  });
});

describe('התאמה חודשית', () => {
  it('מסכם צפוי מול שנכנס', () => {
    const r = reconcile([
      check({ id: '1', amount: '2200.00', status: 'cleared' }),
      check({ id: '2', amount: '3000.00', status: 'cleared' }),
      check({ id: '3', amount: '1800.00' }),
    ], TODAY);

    expect(r.expected).toBe(toAgorot('7000'));
    expect(r.received).toBe(toAgorot('5200'));
    expect(r.outstanding).toBe(toAgorot('1800'));
    expect(r.settled).toBe(false);
  });

  it('פירעון חלקי — "הועבר 2000 במקום 2200" — משאיר יתרה פתוחה', () => {
    const r = reconcile([
      check({ id: '1', amount: '2200.00', status: 'partial', cleared_amount: '2000.00' }),
    ], TODAY);

    expect(r.received).toBe(toAgorot('2000'));
    expect(r.shortfall).toBe(toAgorot('200'));
    // ההפרש אינו נעלם, וגם אינו נספר כחוב מלא
    expect(r.outstanding).toBe(0);
  });

  it('צ׳ק שחזר הוא חוב מלא ולא חוסר חלקי', () => {
    const r = reconcile([check({ id: '1', amount: '2200.00', status: 'bounced' })], TODAY);
    expect(r.bounced).toBe(toAgorot('2200'));
    expect(r.shortfall).toBe(0);
    expect(r.received).toBe(0);
  });

  it('צ׳ק מבוטל אינו נספר בשום סכום', () => {
    const r = reconcile([
      check({ id: '1', amount: '2200.00', status: 'void' }),
      check({ id: '2', amount: '1000.00', status: 'cleared' }),
    ], TODAY);
    expect(r.expected).toBe(toAgorot('1000'));
    expect(r.received).toBe(toAgorot('1000'));
  });

  it('חודש סגור כשאין שום דבר פתוח', () => {
    const r = reconcile([
      check({ id: '1', status: 'cleared' }),
      check({ id: '2', status: 'partial', cleared_amount: '100.00' }),
      check({ id: '3', status: 'bounced' }),
    ], TODAY);
    expect(r.settled).toBe(true);
  });

  it('סופר לפי מצב תצוגה ולא לפי מצב במסד', () => {
    const r = reconcile([
      check({ id: '1', due_on: '2026-09-10' }),
      check({ id: '2', due_on: '2026-09-15' }),
      check({ id: '3', due_on: '2026-09-30' }),
    ], TODAY);
    expect(r.counts.overdue).toBe(1);
    expect(r.counts.due_today).toBe(1);
    expect(r.counts.upcoming).toBe(1);
  });

  it('רשימה ריקה אינה שוברת כלום', () => {
    const r = reconcile([], TODAY);
    expect(r.expected).toBe(0);
    expect(r.settled).toBe(true);
  });
});

describe('דורש טיפול', () => {
  it('כולל איחור, היום, וצ׳קים שחזרו — ולא עתידיים', () => {
    const items = needsAttention([
      check({ id: 'late', due_on: '2026-09-01' }),
      check({ id: 'today', due_on: '2026-09-15' }),
      check({ id: 'bounced', status: 'bounced' }),
      check({ id: 'future', due_on: '2026-11-01' }),
      check({ id: 'done', status: 'cleared' }),
    ], TODAY);
    expect(items.map((c) => c.id).sort()).toEqual(['bounced', 'late', 'today']);
  });
});

describe('חלון חודש', () => {
  it('מכסה את החודש כולו', () => {
    const w = monthWindow(new Date('2026-09-15T00:00:00Z'));
    expect(w.from).toBe('2026-09-01');
    expect(w.to).toBe('2026-09-30');
  });

  it('פברואר מעוברת', () => {
    expect(monthWindow(new Date('2028-02-10T00:00:00Z')).to).toBe('2028-02-29');
  });

  it('גלגול חוצה שנה', () => {
    expect(monthWindow(shiftMonth(new Date('2026-12-05T00:00:00Z'), 1)).from).toBe('2027-01-01');
    expect(monthWindow(shiftMonth(new Date('2026-01-05T00:00:00Z'), -1)).from).toBe('2025-12-01');
  });
});
