import { PRESETS } from '@bossi/kernel';
import { createTenant, withPlatform, withPrincipal } from '../client';
import { createContact, createCustomer, createUser } from '../repositories';
import { createDocument } from '../documents';
import { createCheck, createCheckBatch } from '../checks';
import { createLease, createProperty } from '../leases';
import { createNote } from '../notes';
import { publishEvent } from '../events';

/**
 * דייר הדגמה לראובן מסיקה — יזם נדל"ן.
 *
 * דירות בודדות (בלי היררכיית בניין), ~35 צ'קים בחודש, סימון ידני.
 * התאריכים יחסיים ל"עכשיו", כדי שהחודש הנוכחי תמיד יהיה מלא ושתמיד
 * יהיו חוזים בדיוק בטווח ההתראה של שלושה חודשים.
 */

const DAY = 86_400_000;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CITIES = ['תל אביב', 'רמת גן', 'גבעתיים', 'בת ים', 'חולון', 'פתח תקווה', 'ראשון לציון'];
const STREETS = ['הרצל', 'ביאליק', 'ז׳בוטינסקי', 'רוטשילד', 'אחד העם', 'סוקולוב', 'ויצמן', 'בן גוריון', 'ארלוזורוב', 'הגליל'];
const BANKS = ['לאומי', 'הפועלים', 'דיסקונט', 'מזרחי טפחות', 'הבינלאומי'];

const TENANTS = [
  'אבי שמעוני', 'מיכל רוזנברג', 'יוסי אלקיים', 'דנה פרץ', 'עומר בן-דוד',
  'שירה נחמיאס', 'רון אלמליח', 'נועה קפלן', 'איתי שטרן', 'ליאת אזולאי',
  'מוטי גבאי', 'תמר וקנין', 'ניר הרוש', 'הילה סבן', 'אלון מלכה',
  'רויטל דהן', 'גיא אוחיון', 'ספיר טל', 'עידן ביטון', 'מאיה לוגסי',
  'ארז חדד', 'קרן שרעבי', 'טל אמסלם', 'יעל בוזגלו', 'שי מרציאנו',
  'אורי צרפתי', 'לינוי עמר', 'דור זכריה', 'רותם אבוטבול', 'עמית סויסה',
  'חן ביטון', 'ניצן אדרי', 'יובל אסולין', 'שני חזן', 'רם נגר',
];

export async function seedRealEstate(log: (m: string) => void = console.log): Promise<string> {
  const random = rng(77345219);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!;
  const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));

  const tenantId = await createTenant({
    slug: 'demo-masika',
    name: 'ר. מסיקה — נכסים והשקעות',
    plan: 'mega',
    // ההרכבה של נדל"ן ולא כל המודולים: לראובן אין ריטיינרים, קטלוג
    // ולא מלאי, ואין סיבה שהוא יראה אותם בתפריט. זו בדיוק הנקודה
    // שבשבילה נבנתה ארכיטקטורת המודולים.
    modules: PRESETS.realestate,
    businessId: '037724119',
  });
  await withPlatform((tx) => tx.query('update tenants set is_demo = true where id = $1', [tenantId]));

  // הצוות של ראובן — הבעלים, מנהלת משרד, והנהלת חשבונות.
  // התפקידים אינם קישוט: המזכירה לא מוחקת רישומים, והנהלת החשבונות
  // מסמנת צ'קים אבל לא עורכת חוזים.
  const owner = await withPlatform(async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `insert into users (tenant_id, email, name, role)
       values ($1, 'reuven@masika-nadlan.co.il', 'ראובן מסיקה', 'owner') returning id`,
      [tenantId],
    );
    return rows[0]!.id;
  });

  const principal = { tenantId, userId: owner, role: 'owner' };
  let checkCount = 0;

  await withPrincipal(principal, async (tx) => {
    await createUser(tx, { email: 'sigal@masika-nadlan.co.il', name: 'סיגל אוחנה', role: 'staff' });
    await createUser(tx, { email: 'books@masika-nadlan.co.il', name: 'אמיר כהן', role: 'bookkeeper' });

    for (const [i, name] of TENANTS.entries()) {
      // תאריך הסיום נקבע ראשון ומתוכנן, ולא נגזר מהתחלה אקראית —
      // אחרת רוב החוזים נופלים ל"כבר נגמר" ו"לקראת סיום" נשאר ריק,
      // וזו בדיוק ההתראה שהמערכת קיימת בשבילה.
      //
      // הפריסה: 4 בטווח ההתראה של שלושה חודשים, 3 שמועד ההודעה שלהם
      // מתקרב, 2 שחלון ההודעה שלהם כבר נסגר, 1 שנשכח לגמרי, והשאר רגועים.
      let noticeDays = pick([60, 90, 90, 120]);
      let daysToEnd: number;
      if (i < 5) { noticeDays = 60; daysToEnd = between(95, 118); }  // לקראת סיום
      else if (i < 9) daysToEnd = noticeDays + between(4, 26);       // מועד ההודעה מתקרב
      else if (i < 12) daysToEnd = noticeDays - between(8, 40);      // חלון ההודעה נסגר
      else if (i < 13) daysToEnd = -between(20, 60);                 // נשכח
      else daysToEnd = between(150, 600);                            // רגוע

      const endsOn = new Date(Date.now() + daysToEnd * DAY);
      // הטווח נבחר כך שהחוזה **כבר התחיל**. חוזה שמתחיל בעתיד אין לו
      // צ'קים החודש, ואז מסך ההתאמה מציג פחות ממה שראובן באמת רואה.
      const termMonths = daysToEnd > 300 ? 24 : 12;
      const startsOn = new Date(endsOn.getTime() - termMonths * 30.4 * DAY);
      const rent = between(38, 92) * 100;

      const customerId = await createCustomer(tx, {
        displayName: name,
        businessId: String(between(20000000, 39999999) * 10 + between(0, 9)),
        paymentTermsDays: 0,
        tags: ['שוכר'],
      });
      await createContact(tx, {
        customerId,
        name,
        phone: `05${between(0, 8)}-${between(100, 999)}-${between(1000, 9999)}`,
        email: `${'tenant' + (i + 1)}@example.co.il`,
        roles: ['pays'],
        isPrimary: true,
      });

      const propertyId = await createProperty(tx, {
        name: `${pick(STREETS)} ${between(1, 120)}, דירה ${between(1, 14)}`,
        address: `רח׳ ${pick(STREETS)} ${between(1, 120)}`,
        city: pick(CITIES),
        rooms: pick([2, 2.5, 3, 3.5, 4, 4.5]),
        sizeSqm: between(45, 130),
      });

      const leaseId = await createLease(tx, {
        propertyId,
        customerId,
        startsOn: startsOn.toISOString().slice(0, 10),
        endsOn: endsOn.toISOString().slice(0, 10),
        monthlyRent: String(rent),
        noticeDays,
        depositAmount: String(rent * 2),
        optionMonths: pick([null, 12, 12]),
        signedOn: new Date(startsOn.getTime() - between(3, 21) * DAY).toISOString().slice(0, 10),
      });

      await publishEvent(tx, {
        type: 'leases.signed', actorType: 'user', customerId,
        subjectType: 'lease', subjectId: leaseId,
        occurredAt: new Date(startsOn.getTime() - between(3, 21) * DAY),
        payload: { amount: String(rent) },
      });

      // חוזה סרוק + אישור ביטוח, כי אלה המסמכים שבאמת יש לו
      await createDocument(tx, {
        customerId, title: `חוזה שכירות — ${name}`, filename: `lease-${i + 1}.pdf`,
        storageKey: 'demo:contract.pdf', docType: 'contract', source: 'scan',
        confidence: 0.96, issuedOn: startsOn.toISOString().slice(0, 10),
        expiresOn: endsOn.toISOString().slice(0, 10), byteSize: between(120_000, 900_000),
        createdAt: startsOn,
      });
      if (random() < 0.55) {
        const issued = new Date(Date.now() - between(30, 340) * DAY);
        await createDocument(tx, {
          customerId, title: 'אישור קיום ביטוחים', filename: `ins-${i + 1}.pdf`,
          storageKey: 'demo:insurance.pdf', docType: 'insurance', source: 'email',
          confidence: 0.94, issuedOn: issued.toISOString().slice(0, 10),
          expiresOn: new Date(issued.getTime() + 365 * DAY).toISOString().slice(0, 10),
          byteSize: between(90_000, 400_000), createdAt: issued,
        });
      }

      // חבילת הצ'קים — כפי שהיא מגיעה באמת, שנה מראש בחתימת החוזה
      const batchId = await createCheckBatch(tx, {
        customerId, leaseId,
        receivedOn: startsOn.toISOString().slice(0, 10),
        location: 'כספת המשרד',
      });
      const bank = pick(BANKS);
      const account = `${between(100000, 999999)}`;
      const branch = String(between(100, 899));
      const baseNumber = between(1000, 8000);

      // 12 חודשים אחורה ו-12 קדימה מתאריך תחילת החוזה
      for (let mo = 0; mo < 24; mo++) {
        const due = new Date(startsOn.getFullYear(), startsOn.getMonth() + mo, Math.min(startsOn.getDate(), 28));
        if (due > new Date(Date.now() + 400 * DAY)) break;
        if (due > endsOn) break;

        const past = due.getTime() < Date.now();
        let status: 'pending' | 'cleared' | 'partial' | 'bounced' = 'pending';
        let clearedAmount: string | null = null;

        if (past) {
          const roll = random();
          if (roll < 0.03) status = 'bounced';
          else if (roll < 0.06) { status = 'partial'; clearedAmount = String(rent - pick([100, 200, 300])); }
          else status = 'cleared';
        }

        // "חודש" הוא יחידה קלנדרית ולא 30 יום — אחרת החודש הקודם
        // נגרר לתוך הנוכחי ונראה כאילו ראובן פיגר בכולו.
        //
        // החודש הנוכחי נשאר ברובו לא מסומן: זו העבודה שממתינה לו.
        // מהחודש הקודם נגררים בודדים, כמו בעסק אמיתי שסגר את רובו.
        const now = new Date();
        const monthsPast =
          (now.getFullYear() - due.getFullYear()) * 12 + (now.getMonth() - due.getMonth());
        if (past && monthsPast === 0 && random() < 0.85) { status = 'pending'; clearedAmount = null; }
        else if (past && monthsPast === 1 && random() < 0.12) { status = 'pending'; clearedAmount = null; }

        const checkId = await createCheck(tx, {
          customerId, leaseId, batchId,
          checkNumber: String(baseNumber + mo),
          bankName: bank, branchCode: branch, accountNumber: account,
          amount: String(rent),
          dueOn: due.toISOString().slice(0, 10),
        });
        checkCount++;

        if (status !== 'pending') {
          await tx.query(
            `update checks set status = $2, cleared_amount = $3::numeric,
                    cleared_on = $4::date, cleared_by = $5,
                    cleared_at = $4::date::timestamptz
               where id = $1`,
            [checkId, status, clearedAmount, due.toISOString().slice(0, 10), status === 'bounced' ? null : owner],
          );
          if (status === 'bounced') {
            await publishEvent(tx, {
              type: 'checks.bounced', actorType: 'system', customerId,
              subjectType: 'check', subjectId: checkId, occurredAt: due,
              payload: { amount: String(rent) },
            });
            await createNote(tx, {
              body: `הצ׳ק של ${due.toLocaleDateString('he-IL')} חזר. דיברתי איתו — הבטיח להעביר בהעברה בנקאית תוך שבוע.`,
              customerId, subjectType: 'check', subjectId: checkId,
            });
          }
          if (status === 'partial') {
            await createNote(tx, {
              body: `הועבר ${clearedAmount} במקום ${rent} בחודש ${due.toLocaleDateString('he-IL', { month: 'long' })}. נותרה יתרה של ${rent - Number(clearedAmount)} ₪.`,
              customerId, subjectType: 'check', subjectId: checkId, pinned: true,
            });
          }
        }
      }
    }

    // כמה רישומים כלליים בתיקיות, מהסוג שראובן באמת כותב
    const { rows: some } = await tx.query<{ id: string }>('select id from customers limit 4');
    const bodies = [
      'ביקש לצבוע את הסלון על חשבונו. אישרתי בתנאי שיחזיר למצב המקורי בסוף החוזה.',
      'מבקש להאריך בשנה נוספת. לבדוק העלאה של 4% לפני שמאשרים.',
      'דלף מים בחדר אמבטיה — טופל ע״י אינסטלטור ב-450 ₪. לקזז מהפיקדון או לא? להחליט.',
      'מסר הודעה טלפונית שלא ימשיך. לבקש הודעה בכתב.',
    ];
    for (const [i, r] of some.entries()) {
      await createNote(tx, { body: bodies[i]!, customerId: r.id });
    }
  });

  log(`  ✓ ר. מסיקה — נכסים: ${TENANTS.length} שוכרים · ${TENANTS.length} דירות · ${checkCount} צ׳קים`);
  return tenantId;
}
