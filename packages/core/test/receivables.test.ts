import { describe, expect, it } from 'vitest';
import { aging, bucketOf, casesFromInvoices, collectionQueue, openBalance, scoreCase } from '../src/index';

const TODAY = new Date('2026-09-10T09:00:00');
const inv = (over: Partial<Parameters<typeof openBalance>[0]> = {}) => ({
  id: 'i1', amount: '1000.00', due_on: '2026-09-01', status: 'open', ...over,
});

describe('יתרת חשבונית', () => {
  it('היתרה נגזרת מהסכום פחות ההקצאות', () => {
    expect(openBalance(inv({ amount: '1000.00', paid_amount: '300.00' }))).toBe(70_000);
  });

  it('חשבונית שנפרעה במלואה אינה חוב', () => {
    expect(openBalance(inv({ amount: '1000.00', paid_amount: '1000.00' }))).toBe(0);
  });

  it('תשלום יתר אינו יוצר חוב שלילי', () => {
    expect(openBalance(inv({ amount: '1000.00', paid_amount: '1200.00' }))).toBe(0);
  });

  it('חשבונית מבוטלת או שנמחקה כחוב אינה חוב', () => {
    expect(openBalance(inv({ status: 'void' }))).toBe(0);
    expect(openBalance(inv({ status: 'written_off' }))).toBe(0);
    expect(openBalance(inv({ status: 'draft' }))).toBe(0);
  });
});

describe('אייג׳ינג', () => {
  it('חשבונית שטרם הגיע מועדה יושבת ב-current', () => {
    expect(bucketOf(inv({ due_on: '2026-09-30' }), TODAY)).toBe('current');
  });

  it('היום שאחרי המועד כבר באיחור', () => {
    expect(bucketOf(inv({ due_on: '2026-09-09' }), TODAY)).toBe('d1_30');
  });

  it('גבול 30/31 יום נופל לעמודה הנכונה', () => {
    expect(bucketOf(inv({ due_on: '2026-08-11' }), TODAY)).toBe('d1_30');   // 30 יום
    expect(bucketOf(inv({ due_on: '2026-08-10' }), TODAY)).toBe('d31_60');  // 31 יום
  });

  it('מעל 90 יום נופל לעמודה האחרונה', () => {
    expect(bucketOf(inv({ due_on: '2026-01-01' }), TODAY)).toBe('d90_plus');
  });

  it('מסכם רק את מה שפתוח', () => {
    const result = aging(
      [
        inv({ id: 'a', amount: '1000', due_on: '2026-09-30' }),
        inv({ id: 'b', amount: '2000', due_on: '2026-08-01' }),
        inv({ id: 'c', amount: '5000', due_on: '2026-08-01', status: 'paid', paid_amount: '5000' }),
      ],
      TODAY,
    );
    expect(result.total).toBe(300_000);
    expect(result.overdue).toBe(200_000);
    expect(result.overdueCount).toBe(1);
    expect(result.buckets.current.amount).toBe(100_000);
  });

  it('הגיל הממוצע משוקלל בכסף ולא בכמות', () => {
    // 100 ₪ באיחור 100 יום מול 10,000 ₪ באיחור 10 יום —
    // הממוצע צריך להיצמד לסכום הגדול.
    const result = aging(
      [
        inv({ id: 'a', amount: '100', due_on: '2026-06-02' }),
        inv({ id: 'b', amount: '10000', due_on: '2026-08-31' }),
      ],
      TODAY,
    );
    expect(result.weightedAgeDays).toBeLessThan(12);
  });
});

describe('תור הגבייה', () => {
  it('הבטחה שהופרה עוקפת חוב ותיק יותר', () => {
    const broken = scoreCase(
      { customerId: 'a', customerName: 'א', balance: 500_000, oldestDays: 20, invoiceCount: 1,
        promise: { promisedFor: '2026-09-01', status: 'open' } },
      TODAY,
    );
    const old = scoreCase(
      { customerId: 'b', customerName: 'ב', balance: 500_000, oldestDays: 70, invoiceCount: 1 },
      TODAY,
    );
    expect(broken.action).toBe('call_now');
    expect(broken.score).toBeGreaterThan(old.score);
  });

  it('הבטחה שמועדה עוד לא הגיע מורידה מהתור', () => {
    const c = scoreCase(
      { customerId: 'a', customerName: 'א', balance: 500_000, oldestDays: 40, invoiceCount: 1,
        promise: { promisedFor: '2026-09-20', status: 'open' } },
      TODAY,
    );
    expect(c.action).toBe('wait_promise');
  });

  it('לקוח שדובר איתו אתמול לא חוזר לתור', () => {
    const c = scoreCase(
      { customerId: 'a', customerName: 'א', balance: 500_000, oldestDays: 40, invoiceCount: 1,
        lastContactAt: '2026-09-09' },
      TODAY,
    );
    expect(c.action).toBe('recently_contacted');
  });

  it('גבייה מושהית גוברת על כל אות אחר', () => {
    const c = scoreCase(
      { customerId: 'a', customerName: 'א', balance: 900_000, oldestDays: 200, invoiceCount: 4,
        paused: true, promise: { promisedFor: '2026-01-01', status: 'broken' } },
      TODAY,
    );
    expect(c.action).toBe('paused');
  });

  it('חוב מעל 90 יום מוסלם', () => {
    const c = scoreCase({ customerId: 'a', customerName: 'א', balance: 100_000, oldestDays: 120, invoiceCount: 1 }, TODAY);
    expect(c.action).toBe('escalate');
  });

  it('פי עשרה חוב אינו פי עשרה דחיפות', () => {
    const small = scoreCase({ customerId: 'a', customerName: 'א', balance: 100_000, oldestDays: 30, invoiceCount: 1 }, TODAY);
    const big = scoreCase({ customerId: 'b', customerName: 'ב', balance: 1_000_000, oldestDays: 30, invoiceCount: 1 }, TODAY);
    expect(big.score - small.score).toBeLessThan(10);
  });

  it('התור ממוין לפי פעולה ואז לפי ניקוד', () => {
    const queue = collectionQueue(
      [
        { customerId: 'a', customerName: 'א', balance: 100_000, oldestDays: 5, invoiceCount: 1 },
        { customerId: 'b', customerName: 'ב', balance: 100_000, oldestDays: 60, invoiceCount: 1 },
        { customerId: 'c', customerName: 'ג', balance: 100_000, oldestDays: 200, invoiceCount: 1 },
      ],
      TODAY,
    );
    expect(queue.map((c) => c.customerId)).toEqual(['b', 'c', 'a']);
  });

  it('תיק אחד ללקוח, גם כשיש כמה חשבוניות', () => {
    const cases = casesFromInvoices(
      [
        { ...inv({ id: 'a', amount: '1000', due_on: '2026-08-01' }), customer_id: 'x', customer_name: 'איקס' },
        { ...inv({ id: 'b', amount: '2000', due_on: '2026-06-01' }), customer_id: 'x', customer_name: 'איקס' },
        { ...inv({ id: 'c', amount: '3000', due_on: '2026-12-01' }), customer_id: 'x', customer_name: 'איקס' },
      ],
      TODAY,
    );
    expect(cases).toHaveLength(1);
    expect(cases[0]!.balance).toBe(300_000);   // מה שטרם הגיע מועדו אינו בתיק
    expect(cases[0]!.invoiceCount).toBe(2);
    expect(cases[0]!.oldestDays).toBe(101);
  });
});

describe('ניסוח זמן', () => {
  it('תזכורת מהיום אינה "לפני 0 ימים"', () => {
    const c = scoreCase(
      { customerId: 'a', customerName: 'א', balance: 100_000, oldestDays: 30, invoiceCount: 1,
        lastContactAt: '2026-09-10' },
      TODAY,
    );
    expect(c.reason).toBe('נשלחה תזכורת היום');
  });

  it('תזכורת מאתמול נאמרת כאתמול', () => {
    const c = scoreCase(
      { customerId: 'a', customerName: 'א', balance: 100_000, oldestDays: 30, invoiceCount: 1,
        lastContactAt: '2026-09-09' },
      TODAY,
    );
    expect(c.reason).toBe('נשלחה תזכורת אתמול');
  });

  it('הבטחה למחר אינה "בעוד 1 ימים"', () => {
    const c = scoreCase(
      { customerId: 'a', customerName: 'א', balance: 100_000, oldestDays: 30, invoiceCount: 1,
        promise: { promisedFor: '2026-09-11', status: 'open' } },
      TODAY,
    );
    expect(c.reason).toBe('הבטיח לשלם מחר');
  });
});
