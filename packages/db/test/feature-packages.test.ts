import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PRESETS } from '@bossi/kernel';
import {
  applyFeaturePackageToTenant, closePool, createFeaturePackage, createTenant, deleteFeaturePackage,
  duplicateFeaturePackage, getFeaturePackage, listFeaturePackages, migrate, seedDefaultPackages,
  tenantModules, updateFeaturePackage, withPlatform,
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

  it('יצירה, עריכה ומחיקה', async () => {
    const id = await createFeaturePackage({
      name: 'חבילת עורך דין 1', description: 'תבנית ראשונה', moduleIds: ['documents', 'search'],
    });
    const created = await getFeaturePackage(id);
    expect(created?.name).toBe('חבילת עורך דין 1');
    expect(created?.is_template).toBe(true); // ברירת מחדל
    expect(created?.slug).toMatch(/^pkg-/); // לא נחשף לעריכה — מזהה פנימי בלבד

    const updated = await updateFeaturePackage(id, {
      name: 'חבילת עורך דין 1 — מעודכן', moduleIds: ['documents', 'search', 'billing'], isTemplate: true,
    });
    expect(updated).toBe(true);
    const after = await getFeaturePackage(id);
    expect(after?.name).toBe('חבילת עורך דין 1 — מעודכן');
    expect(after?.module_ids).toEqual(['documents', 'search', 'billing']);

    expect(await deleteFeaturePackage(id)).toBe(true);
    expect(await getFeaturePackage(id)).toBeNull();
  });

  it('שכפול יוצר עותק עצמאי, לא הפניה', async () => {
    const sourceId = await createFeaturePackage({
      name: 'חבילת עורך דין 1', moduleIds: ['documents', 'billing'],
    });
    const copyId = await duplicateFeaturePackage(sourceId, 'חבילת עורך דין 2');
    expect(copyId).not.toBe(sourceId);

    const copy = await getFeaturePackage(copyId!);
    expect(copy?.name).toBe('חבילת עורך דין 2');
    expect(copy?.module_ids).toEqual(['documents', 'billing']);

    // עריכת המקור לא נוגעת בעותק — שתי שורות עצמאיות, לא שיתוף מבנה.
    await updateFeaturePackage(sourceId, { name: 'שונה', moduleIds: ['documents'], isTemplate: true });
    const copyAfter = await getFeaturePackage(copyId!);
    expect(copyAfter?.name).toBe('חבילת עורך דין 2');
    expect(copyAfter?.module_ids).toEqual(['documents', 'billing']);
  });

  it('שכפול חבילה שלא קיימת מחזיר null ולא זורק', async () => {
    expect(await duplicateFeaturePackage('00000000-0000-0000-0000-000000000000', 'x')).toBeNull();
  });

  describe('החלה על דייר', () => {
    it('מחליפה — לא מצרפת — את המודולים הפעילים', async () => {
      const stamp = Date.now().toString(36);
      const tenantId = await createTenant({
        slug: `pkgtest-a-${stamp}`, name: 'דייר לבדיקה', modules: ['documents', 'retainers', 'alerts'],
      });
      const packageId = await createFeaturePackage({
        name: 'עסקי מוצר B2B', moduleIds: [...PRESETS.commerce],
      });

      const ok = await applyFeaturePackageToTenant(tenantId, packageId);
      expect(ok).toBe(true);

      const modules = await tenantModules(tenantId);
      const enabled = new Set(modules.filter((m) => m.enabled).map((m) => m.module_id));
      expect(enabled).toEqual(new Set(PRESETS.commerce));
      // retainers ו-alerts היו דלוקים לפני ההחלה ואינם בחבילה החדשה — כבויים עכשיו.
      expect(enabled.has('retainers')).toBe(false);
    });

    it('מודול שנשאר משני הצדדים לא מאבד את מועד ההדלקה המקורי שלו', async () => {
      const stamp = Date.now().toString(36);
      const tenantId = await createTenant({ slug: `pkgtest-b-${stamp}`, name: 'דייר לבדיקה', modules: ['documents'] });
      const before = await withPlatform((tx) =>
        tx.query<{ enabled_at: Date }>(
          "select enabled_at from tenant_modules where tenant_id = $1 and module_id = 'documents'", [tenantId],
        ),
      );

      const packageId = await createFeaturePackage({ name: 'כולל מסמכים', moduleIds: ['documents', 'search'] });
      await applyFeaturePackageToTenant(tenantId, packageId);

      const after = await withPlatform((tx) =>
        tx.query<{ enabled_at: Date }>(
          "select enabled_at from tenant_modules where tenant_id = $1 and module_id = 'documents'", [tenantId],
        ),
      );
      expect(new Date(after.rows[0]!.enabled_at).getTime()).toBe(new Date(before.rows[0]!.enabled_at).getTime());
    });

    it('חבילה שלא קיימת לא נוגעת בדייר ומחזירה false', async () => {
      const stamp = Date.now().toString(36);
      const tenantId = await createTenant({ slug: `pkgtest-c-${stamp}`, name: 'דייר לבדיקה', modules: ['documents'] });
      const ok = await applyFeaturePackageToTenant(tenantId, '00000000-0000-0000-0000-000000000000');
      expect(ok).toBe(false);

      const modules = await tenantModules(tenantId);
      expect(modules.filter((m) => m.enabled).map((m) => m.module_id)).toEqual(['documents']);
    });
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
