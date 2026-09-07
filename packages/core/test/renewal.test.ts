import { describe, expect, it } from 'vitest';
import { leaseTiming, needsDecision, type LeaseLike } from '../src/index';

const TODAY = new Date('2026-09-15T10:00:00Z');
const lease = (o: Partial<LeaseLike> & { id: string }): LeaseLike => ({
  ends_on: '2027-06-30', notice_days: 90, status: 'active', ...o,
});

describe('ראדאר חידושים', () => {
  it('מועד ההודעה מוקדם מתאריך הסיום במספר ימי ההודעה', () => {
    const t = leaseTiming(lease({ id: 'a', ends_on: '2026-12-31', notice_days: 90 }), TODAY);
    expect(t.noticeDeadline.toISOString().slice(0, 10)).toBe('2026-10-02');
  });

  it('חוזה בוער כשחלון ההודעה נסגר — גם אם הסיום רחוק', () => {
    // נגמר בעוד יותר מחודשיים, אבל מועד ההודעה כבר עבר
    const t = leaseTiming(lease({ id: 'a', ends_on: '2026-11-30', notice_days: 90 }), TODAY);
    expect(t.daysToEnd).toBeGreaterThan(60);
    expect(t.urgency).toBe('critical');
  });

  it('התראה שלושה חודשים מראש כפי שהוגדר', () => {
    const t = leaseTiming(lease({ id: 'a', ends_on: '2026-12-20', notice_days: 30 }), TODAY);
    expect(t.daysToEnd).toBeLessThanOrEqual(120);
    expect(t.urgency).toBe('upcoming');
  });

  it('מועד ההודעה בתוך חודש', () => {
    const t = leaseTiming(lease({ id: 'a', ends_on: '2026-12-31', notice_days: 100 }), TODAY);
    expect(t.urgency).toBe('due');
  });

  it('חוזה שנגמר ואיש לא נגע', () => {
    expect(leaseTiming(lease({ id: 'a', ends_on: '2026-08-01' }), TODAY).urgency).toBe('passed');
  });

  it('חוזה רחוק שקט', () => {
    expect(leaseTiming(lease({ id: 'a', ends_on: '2028-01-01' }), TODAY).urgency).toBe('quiet');
  });

  it('חוזה שהסתיים רשמית אינו מתריע', () => {
    expect(leaseTiming(lease({ id: 'a', ends_on: '2026-01-01', status: 'ended' }), TODAY).urgency).toBe('ended');
  });

  it('הסדר הוא סדר הדחיפות, ושקטים לא נכנסים', () => {
    const list = needsDecision([
      lease({ id: 'quiet', ends_on: '2029-01-01' }),
      lease({ id: 'upcoming', ends_on: '2026-12-20', notice_days: 30 }),
      lease({ id: 'passed', ends_on: '2026-08-01' }),
      lease({ id: 'critical', ends_on: '2026-11-30', notice_days: 90 }),
    ], TODAY);
    expect(list.map((l) => l.id)).toEqual(['passed', 'critical', 'upcoming']);
  });
});
