import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, migrate, withPlatform } from '../src/index';

/**
 * כלל 1א — **כל FK אל ישות של דייר הוא מורכב וכולל `tenant_id`.**
 *
 * בדיקת FK רצה בתוך המסד ומתעלמת מ-RLS. לכן `references customers(id)`
 * פשוט מאפשר לשורה של דייר א׳ להצביע על לקוח של דייר ב׳ — הבידוד
 * שורד את השאילתה ונשבר במפתח.
 *
 * כמו `rls-coverage`, הבדיקה סורקת את הסכמה בפועל ולא רשימה שנכתבה
 * ביד: טבלה חדשה עם FK פשוט תיפול כאן, גם אם אף אחד לא זכר את הכלל.
 */

const hasDb = Boolean(process.env['DATABASE_URL']);

/**
 * `tenants` הוא היעד היחיד שמותר להצביע עליו במפתח פשוט — הוא **הדייר
 * עצמו**, לא ישות בתוכו, ואין לו `tenant_id` להצטרף אליו.
 */
const NOT_TENANT_SCOPED = new Set(['tenants']);

interface ForeignKey {
  name: string;
  source: string;
  target: string;
  source_columns: string[];
  target_columns: string[];
}

describe.skipIf(!hasDb)('כיסוי מפתחות זרים', () => {
  let keys: ForeignKey[];

  beforeAll(async () => {
    await migrate(() => {});
    keys = await withPlatform(async (tx) => {
      const { rows } = await tx.query<ForeignKey>(`
        select c.conname                                       as name,
               src.relname                                     as source,
               tgt.relname                                     as target,
               array(
                 select a.attname from unnest(c.conkey) k
                   join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
               )::text[]                                       as source_columns,
               array(
                 select a.attname from unnest(c.confkey) k
                   join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k
               )::text[]                                       as target_columns
          from pg_constraint c
          join pg_class src on src.oid = c.conrelid
          join pg_class tgt on tgt.oid = c.confrelid
          join pg_namespace n on n.oid = src.relnamespace
         where c.contype = 'f' and n.nspname = 'public'
         order by src.relname, c.conname
      `);
      return rows;
    });
  }, 30_000);

  afterAll(async () => {
    await closePool();
  });

  it('נמצאו מפתחות זרים לבדיקה', () => {
    expect(keys.length).toBeGreaterThan(10);
  });

  it('כל FK אל ישות של דייר כולל tenant_id בשני הצדדים', () => {
    const failures = keys
      .filter((k) => !NOT_TENANT_SCOPED.has(k.target))
      .filter((k) => !k.source_columns.includes('tenant_id') || !k.target_columns.includes('tenant_id'))
      .map((k) => `${k.source}.${k.name} → ${k.target} (${k.source_columns.join(', ')})`);

    expect(failures, `מפתחות זרים חוצי-דיירים:\n${failures.join('\n')}`).toEqual([]);
  });

  it('FK אל tenants מצביע על העמודה tenant_id של המקור', () => {
    // המפתח אל הדייר עצמו הוא מה שמאפשר `on delete cascade` אמיתי.
    const failures = keys
      .filter((k) => k.target === 'tenants')
      .filter((k) => k.source_columns.length !== 1 || k.source_columns[0] !== 'tenant_id')
      .map((k) => `${k.source}.${k.name}`);
    expect(failures, `מפתחות חריגים אל tenants: ${failures.join(', ')}`).toEqual([]);
  });
});
