import { describe, expect, it } from 'vitest';
import { CALL_SCRIPT, callSummary, type ScriptOption } from '../lib/call-script';

const steps = Object.entries(CALL_SCRIPT) as [string, (typeof CALL_SCRIPT)[keyof typeof CALL_SCRIPT]][];

describe('תסריט השיחה המודרך', () => {
  it('כל כפתור מוביל לצעד קיים או לתוצאה — אין מבוי סתום', () => {
    for (const [id, step] of steps) {
      for (const option of step.options as readonly ScriptOption[]) {
        const ok = option.outcome !== undefined || (option.next !== undefined && option.next in CALL_SCRIPT);
        expect(ok, `${id} → "${option.label}"`).toBe(true);
      }
    }
  });

  it('כל צעד נגיש מההתחלה', () => {
    const seen = new Set<string>(['start']);
    const queue = ['start'];
    while (queue.length > 0) {
      const step = CALL_SCRIPT[queue.shift() as keyof typeof CALL_SCRIPT];
      for (const option of step.options as readonly ScriptOption[]) {
        if (option.next && !seen.has(option.next)) {
          seen.add(option.next);
          queue.push(option.next);
        }
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(CALL_SCRIPT).sort());
  });

  it('הסיכום רושם את המסלול, התוצאה והערה חופשית', () => {
    const path: ScriptOption[] = [
      { label: 'מזכירה', log: 'ענתה מזכירה' },
      { label: 'מעבירה', log: 'הועבר לבעלים' },
      { label: 'כן' },
      { label: 'צ\'קים', log: 'כאב: צ\'קים' },
    ];
    expect(callSummary(path, 'meeting', '12.10 10:00', ' צ\'ק של 18 אלף חזר בחודש שעבר ')).toBe(
      'שיחה מודרכת ← ענתה מזכירה ← הועבר לבעלים ← כאב: צ\'קים ← נקבעה פגישה 12.10 10:00\nצ\'ק של 18 אלף חזר בחודש שעבר',
    );
  });
});
