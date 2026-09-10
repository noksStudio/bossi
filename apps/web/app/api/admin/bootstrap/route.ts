import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { migrate, resetDemo, seedDemo, seedRealEstate, withPlatform } from '@bossi/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * אתחול חד-פעמי של מסד ריק: מיגרציות וזריעת דיירי הדגמה.
 *
 * קיים כי אין לנו גישה ישירה למסד הענן מסביבת הפיתוח, ולכן צריך נתיב
 * שמריץ את זה מתוך האפליקציה עצמה. הוא מסוכן מטבעו, ולכן חסום בשלושה
 * מנעולים בלתי תלויים:
 *
 *   1. `BOOTSTRAP_SECRET` חייב להיות מוגדר. בלעדיו הנתיב מחזיר 404
 *      ואפילו לא מסגיר שהוא קיים.
 *   2. הסוד בבקשה מושווה בזמן קבוע.
 *   3. **הוא מסרב לרוץ אם קיים ולו דייר אמיתי אחד.** גם סוד שדלף לא
 *      יכול לגעת בנתונים של לקוח משלם.
 *
 * אחרי האתחול: להסיר את `BOOTSTRAP_SECRET` מהסביבה. הנתיב מת מיד.
 */
export async function GET(request: NextRequest) {
  const expected = process.env['BOOTSTRAP_SECRET'];
  if (!expected) return new NextResponse('Not found', { status: 404 });

  const provided = request.nextUrl.searchParams.get('secret') ?? '';
  if (!safeEqual(provided, expected)) return new NextResponse('Not found', { status: 404 });

  const step = request.nextUrl.searchParams.get('step') ?? 'status';
  const log: string[] = [];
  const say = (m: string) => log.push(m.trim());

  try {
    const guard = await realTenantGuard();
    if (guard) return json({ ok: false, error: guard, log }, 409);

    switch (step) {
      case 'status': {
        const state = await status();
        return json({ ok: true, ...state, next: state.migrations === 0 ? 'migrate' : 'seed' });
      }

      case 'migrate': {
        const ran = await migrate(say);
        return json({ ok: true, step, ran: ran.length, log, next: 'seed' });
      }

      case 'seed': {
        await migrate(say);
        await resetDemo(say);
        const r = await seedDemo(say);
        say(`מסמכים: ${r.services.documents + r.commerce.documents}`);
        return json({ ok: true, step, log, next: 'seed-realestate' });
      }

      case 'seed-realestate': {
        await seedRealEstate(say);
        return json({ ok: true, step, log, next: 'done', signin: '/signin' });
      }

      default:
        return json({ ok: false, error: `שלב לא מוכר: ${step}` }, 400);
    }
  } catch (error) {
    return json({ ok: false, error: String(error), log }, 500);
  }
}

/**
 * מסרב לפעול על מסד שיש בו נתונים אמיתיים.
 * זה המנעול שהופך את הנתיב הזה למקובל: גם בתרחיש הגרוע, מה שהוא
 * יכול לגעת בו הוא דיירי הדגמה בלבד.
 */
async function realTenantGuard(): Promise<string | null> {
  try {
    const { rows } = await withPlatform((tx) =>
      tx.query<{ n: string }>('select count(*)::text as n from tenants where is_demo = false'),
    );
    const real = Number(rows[0]?.n ?? 0);
    return real > 0
      ? `המסד מכיל ${real} דיירים אמיתיים. האתחול מסרב לרוץ — הסירו את BOOTSTRAP_SECRET.`
      : null;
  } catch {
    return null; // הטבלאות עוד לא קיימות: מסד ריק, מותר להריץ
  }
}

async function status() {
  try {
    const { rows } = await withPlatform((tx) =>
      tx.query<{ migrations: string; tenants: string; checks: string; documents: string }>(`
        select (select count(*) from _migrations)::text as migrations,
               (select count(*) from tenants)::text     as tenants,
               (select count(*) from checks)::text      as checks,
               (select count(*) from documents)::text   as documents
      `),
    );
    const r = rows[0]!;
    return {
      migrations: Number(r.migrations),
      tenants: Number(r.tenants),
      checks: Number(r.checks),
      documents: Number(r.documents),
    };
  } catch {
    return { migrations: 0, tenants: 0, checks: 0, documents: 0 };
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}
