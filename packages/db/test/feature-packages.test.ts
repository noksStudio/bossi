import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '@bossi/kernel';
import {
  closePool, getFeaturePackage, listFeaturePackages, migrate, seedDefaultPackages, withPlatform,
} from '../src/index';

/**
 * חבילות תכונה — הבדיקה המרכזית היא **insert-if-missing, לעולם לא
 * update**: מנהל שערך שם או תיאור של חבילת ברירת מחדל לא אמור לגלות
 * שההתחברות הבאה שלו דרסה אותם (ADR-011).
 */

const hasDb = Boolean(process.env['DATABASE_URL']);

describe.skipIf(!hasDb)('חבילות תכונה', () => {
  beforeAll(async () => {
    await migrate(() => {});
  }, 30_000);

  beforeEach(async () => {
    await withPlatform((tx) => tx.query('delete from feature_packages'));
  });

  afterAll(async () => {
    await closePool();
  });

  it('הזריעה הראשונה יוצרת חמש חבילות — אחת לכל preset', async () => {
    const created = await seedDefaultPackages();
    expect(created).toBe(5);

    const rows = await listFeaturePackages();
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r.slug))).toEqual(new Set(Object.keys(PRESETS)));
  });

  it('module_ids של חבילת ברירת מחדל תואם בדיוק את ה-preset שלה', async () => {
    await seedDefaultPackages();
    const rows = await listFeaturePackages();
    const services = rows.find((r) => r.slug === 'services')!;
    expect(services.module_ids).toEqual([...PRESETS.services]);
    expect(services.is_template).toBe(true);
  });

  it('זריעה חוזרת אינה יוצרת כפילויות', async () => {
    await seedDefaultPackages();
    const secondRun = await seedDefaultPackages();
    expect(secondRun).toBe(0); // כלום לא חסר בפעם השנייה

    const rows = await listFeaturePackages();
    expect(rows).toHaveLength(5);
  });

  it('זריעה חוזרת לא דורסת שם או תיאור שנערכו ידנית', async () => {
    await seedDefaultPackages();
    const rows = await listFeaturePackages();
    const target = rows.find((r) => r.slug === 'services')!;

    await withPlatform((tx) =>
      tx.query('update feature_packages set name = $2, description = $3 where id = $1', [
        target.id, 'חבילת עורך דין 1', 'הגרסה שאני בעצמי מפעיל אצל לקוחות',
      ]),
    );

    await seedDefaultPackages(); // הרצה חוזרת — כאילו התחברות נוספת

    const after = await getFeaturePackage(target.id);
    expect(after?.name).toBe('חבילת עורך דין 1');
    expect(after?.description).toBe('הגרסה שאני בעצמי מפעיל אצל לקוחות');
  });

  it('חבילה חד-פעמית (is_template=false) לא נוגעים בה בזריעה', async () => {
    await seedDefaultPackages();
    const { rows } = await withPlatform((tx) =>
      tx.query<{ id: string }>(
        `insert into feature_packages (slug, name, module_ids, is_template)
         values ('masika-nadlan', 'ראובן מסיקה נכסים', $1, false) returning id`,
        [[...PRESETS.realestate, 'portal']],
      ),
    );

    await seedDefaultPackages();

    const custom = await getFeaturePackage(rows[0]!.id);
    expect(custom?.is_template).toBe(false);
    expect(custom?.module_ids).toEqual([...PRESETS.realestate, 'portal']);

    const all = await listFeaturePackages();
    expect(all).toHaveLength(6); // חמש ברירות מחדל + החד-פעמית
  });

  it('רשימה ממוינת: תבניות לפני חד-פעמיות', async () => {
    await seedDefaultPackages();
    await withPlatform((tx) =>
      tx.query(
        `insert into feature_packages (slug, name, module_ids, is_template)
         values ('unique-a', 'א׳ ייחודי', '{}', false)`,
      ),
    );

    const rows = await listFeaturePackages();
    const lastTemplateIdx = rows.map((r) => r.is_template).lastIndexOf(true);
    const firstCustomIdx = rows.map((r) => r.is_template).indexOf(false);
    expect(lastTemplateIdx).toBeLessThan(firstCustomIdx);
  });
});
