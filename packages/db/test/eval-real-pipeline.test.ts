import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  classifyDocument, extractBusinessIds, extractCounterparties, extractPdfText, hasExtractableText,
} from '@bossi/ai';
import {
  closePool, matchCustomers, migrate, seed, withPlatform, withTenant,
} from '../src/index';

/**
 * eval על הצינור המלא — לא חלק בודד. PDF אמיתי → חילוץ טקסט → סיווג
 * → חילוץ שדות → חילוץ צד נגדי → התאמת לקוח, נגד ה-seed האמיתי
 * (`seed()`, אותו seed שרץ ב-`pnpm db:seed`) ולא נתוני בדיקה מיוחדים —
 * בדיוק כדי לוודא שהחיווט בפועל (upload/route.ts) עובד על נתונים
 * שמישהו יראה באמת, לא רק שכל שלב עובד בבידוד (כבר נבדק ב-eval
 * נפרדים בכל שלב: packages/ai/test/eval-real-*.test.ts, ADR-014/015).
 *
 * seed.ts נכתב כך שהלקוחות שבו תואמים בכוונה את התוכן של
 * public/demo/*.pdf (למשל "דני כהן — סטודיו" עם legal_name
 * "ד. כהן עיצוב בע״מ" ו-business_id 515993027, בדיוק כמו בחשבונית/
 * קבלה/אישור ניכוי מס האמיתיים) — זו לא צירוף מקרים, זה מה שהופך
 * את ה-eval הזה לבעל ערך.
 */

const hasDb = Boolean(process.env['DATABASE_URL']);
const DEMO_DIR = `${import.meta.dirname}/../../../apps/web/public/demo`;

describe.skipIf(!hasDb)('eval צינור מלא: PDF אמיתי → חילוץ → סיווג → התאמת לקוח', () => {
  let services: string;
  let commerce: string;

  beforeAll(async () => {
    await withPlatform((tx) => tx.query('drop schema public cascade; create schema public;'));
    await migrate(() => {});
    const tenants = await seed(() => {});
    services = tenants.services;
    commerce = tenants.commerce;
  }, 30_000);

  afterAll(async () => {
    await closePool();
  });

  async function pipeline(tenantId: string, file: string) {
    const bytes = await readFile(`${DEMO_DIR}/${file}`);
    const extracted = await extractPdfText(bytes);
    expect(hasExtractableText(extracted)).toBe(true);
    const classification = classifyDocument(extracted.text);
    const businessIds = extractBusinessIds(extracted.pages).map((f) => f.value);
    const names = extractCounterparties(extracted.pages).map((c) => c.name);
    const matches = await withTenant(tenantId, (tx) => matchCustomers(tx, { businessIds, names }));
    return { classification, matches };
  }

  it('חשבונית (לביא ושות׳): מסווגת נכון ומשויכת ללקוח הנכון, גם כשביטחון הסיווג עצמו מתחת לסף', async () => {
    // ממצא אמיתי מה-eval (לא היה ידוע מראש): ביטחון הסיווג של invoice.pdf
    // הוא 0.64 — מתחת ל-AUTO_FILE_THRESHOLD (0.8), כמו שכבר תועד ב-eval
    // הסיווג הנפרד (packages/ai/eval-real-files.test.ts): "ביטחון נמוך על
    // תוצאה נכונה הוא תקין ומצופה". בפועל: סוג המסמך יישאר needs_review
    // בהעלאה אמיתית — אבל שיוך הלקוח בלתי-תלוי לגמרי (אות שונה, ח.פ.
    // מדויק), ועדיין עובר את הסף. שני האותות מוערכים בנפרד, כמתוכנן.
    const { classification, matches } = await pipeline(services, 'invoice.pdf');
    expect(classification.type).toBe('invoice');
    expect(matches[0]?.displayName).toBe('דני כהן — סטודיו');
    expect(matches[0]!.confidence).toBeGreaterThan(0.8);
  });

  it('הצעת מחיר (לביא ושות׳): מסווגת נכון, ומשויכת ל"מעבדות תבל בע״מ"', async () => {
    const { classification, matches } = await pipeline(services, 'quote.pdf');
    expect(classification.type).toBe('quote');
    expect(matches[0]?.displayName).toBe('מעבדות תבל בע״מ');
  });

  it('קבלה (לביא ושות׳): מסווגת נכון, "התקבל מאת" מוצא את אותו לקוח כמו בחשבונית', async () => {
    const { classification, matches } = await pipeline(services, 'receipt.pdf');
    expect(classification.type).toBe('receipt');
    expect(matches[0]?.displayName).toBe('דני כהן — סטודיו');
  });

  it('אישור ניכוי מס (לביא ושות׳): "שם העוסק" מוצא את הלקוח לפי legal_name בלבד', async () => {
    const { matches } = await pipeline(services, 'tax-exemption.pdf');
    expect(matches[0]?.displayName).toBe('דני כהן — סטודיו');
  });

  it('תעודת משלוח (תבור אספקה טכנית): שם חלקי (מגבלת RTL, ADR-015) עדיין מספיק ל-fuzzy match', async () => {
    const { classification, matches } = await pipeline(commerce, 'delivery-note.pdf');
    expect(classification.type).toBe('delivery_note');
    expect(matches[0]?.displayName).toBe('מוסך הצפון');
  });

  it('חוזה (לביא ושות׳): הלקוח האמיתי נמצא; הדייר עצמו (הצד השני בחוזה) לא מתאים לאף לקוח', async () => {
    const { matches } = await pipeline(services, 'contract.pdf');
    expect(matches.some((m) => m.displayName === 'דני כהן — סטודיו' && m.confidence > 0.8)).toBe(true);
    expect(matches.every((m) => m.displayName !== 'לביא ושות׳')).toBe(true);
  });

  it('ערבות בנקאית (תבור אספקה טכנית): אין ללקוח הזה רשומה בטבלה — matchCustomers לא ממציאה התאמה', async () => {
    const { matches } = await pipeline(commerce, 'bank-guarantee.pdf');
    expect(matches).toEqual([]);
  });
});
