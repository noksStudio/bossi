import { describe, expect, it } from 'vitest';
import { classifyEngagement, ENGAGEMENT_LABELS, ENGAGEMENT_SUGGESTIONS } from '../src/index';

describe('סיווג מעורבות', () => {
  it('אפס כניסות ואפס פעולות — רדום', () => {
    const e = classifyEngagement({ logins: 0, actions: 0 });
    expect(e.score).toBe(0);
    expect(e.tier).toBe('dormant');
  });

  it('מעט מאוד פעילות — בסיכון נטישה', () => {
    const e = classifyEngagement({ logins: 1, actions: 0 });
    expect(e.score).toBe(1);
    expect(e.tier).toBe('at_risk');
  });

  it('רף "בסיכון" עצמו — עדיין בסיכון, לא רדום', () => {
    expect(classifyEngagement({ logins: 0, actions: 1 }).tier).toBe('at_risk');
  });

  it('פעילות סדירה — פעיל', () => {
    const e = classifyEngagement({ logins: 3, actions: 2 });
    expect(e.score).toBe(5);
    expect(e.tier).toBe('engaged');
  });

  it('רגע לפני "פעיל" — עדיין בסיכון נטישה', () => {
    expect(classifyEngagement({ logins: 2, actions: 2 }).tier).toBe('at_risk');
  });

  it('שימוש כמעט-יומי — פעיל חזק', () => {
    const e = classifyEngagement({ logins: 14, actions: 8 });
    expect(e.score).toBe(22);
    expect(e.tier).toBe('power');
  });

  it('רגע לפני "פעיל חזק" — עדיין רק פעיל', () => {
    expect(classifyEngagement({ logins: 10, actions: 9 }).tier).toBe('engaged');
  });

  it('כניסות ופעולות שוקלות אותו דבר — אותו ציון בכל חלוקה', () => {
    const a = classifyEngagement({ logins: 10, actions: 0 });
    const b = classifyEngagement({ logins: 0, actions: 10 });
    const c = classifyEngagement({ logins: 5, actions: 5 });
    expect(a.score).toBe(b.score);
    expect(b.score).toBe(c.score);
    expect(a.tier).toBe(b.tier);
    expect(b.tier).toBe(c.tier);
  });

  it('כל שכבה נושאת תווית והצעת פעולה בעברית', () => {
    for (const tier of ['power', 'engaged', 'at_risk', 'dormant'] as const) {
      expect(ENGAGEMENT_LABELS[tier]).toBeTruthy();
      expect(ENGAGEMENT_SUGGESTIONS[tier]).toBeTruthy();
    }
  });
});
