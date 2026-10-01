import { describe, expect, it } from 'vitest';
import { parseLeadList } from '../lib/lead-list';

describe('parseLeadList — רשימת לידים מודבקת', () => {
  it('שם | טלפון | כתובת | תחום', () => {
    expect(parseLeadList('דורמקו | 09-9500040 | יד חרוצים 11, פולג | כימיקלים')).toEqual([
      { name: 'דורמקו', phone: '09-9500040', address: 'יד חרוצים 11, פולג', note: 'כימיקלים' },
    ]);
  });

  it('טבלה שהועתקה מהמסמך: טאבים, כותרת, קישור בשם, הטלפון בעמודה השלישית', () => {
    const raw = [
      'עסק\tתחום\tטלפון\tכתובת\tהתאמה\tסטטוס',
      '[ניומרקט](https://www.newmarket.co.il/Contact)\tמוצרי פרסום\t09-8655200\tגיבורי ישראל 15\tגבוהה\t',
    ].join('\n');
    expect(parseLeadList(raw)).toEqual([
      { name: 'ניומרקט', phone: '09-8655200', address: 'גיבורי ישראל 15', note: 'מוצרי פרסום · גבוהה' },
    ]);
  });

  it('מספרים בינלאומיים וניידים מזוהים, שורות בלי טלפון תקין מדולגות', () => {
    const raw = [
      'עסק א | +972 9-887-3565',
      'עסק ב | 054-9414343 | שז"ר 7',
      'שורה בלי טלפון | יד חרוצים 11',
      'מספר 1-700 | 1-700-507181',
      '',
    ].join('\n');
    expect(parseLeadList(raw).map((r) => [r.name, r.phone, r.address])).toEqual([
      ['עסק א', '+972 9-887-3565', null],
      ['עסק ב', '054-9414343', 'שז"ר 7'],
    ]);
  });
});
