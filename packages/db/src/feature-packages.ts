import { PRESETS } from '@bossi/kernel';
import { withPlatform, type Tx } from './client';

/**
 * חבילות תכונה — התבנית שממנה מרכיבים דייר חדש.
 *
 * שייכות לריאלם הפלטפורמה (0012): בלי `tenant_id`, בלי גישה מ-`bossi_app`,
 * רק `withPlatform`. שכבת ה-CRUD המלאה (יצירה, עריכה, שכפול, שיוך לדייר)
 * נבנית בספרינט הבא — כאן רק הקריאה והזרעת ברירות המחדל.
 */

export interface FeaturePackageRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  module_ids: string[];
  is_template: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function listFeaturePackages(): Promise<FeaturePackageRow[]> {
  return withPlatform(async (tx) => {
    const { rows } = await tx.query<FeaturePackageRow>(
      `select id, slug, name, description, module_ids, is_template, created_at, updated_at
         from feature_packages
        order by is_template desc, name`,
    );
    return rows;
  });
}

export async function getFeaturePackage(id: string): Promise<FeaturePackageRow | null> {
  return withPlatform(async (tx) => {
    const { rows } = await tx.query<FeaturePackageRow>(
      `select id, slug, name, description, module_ids, is_template, created_at, updated_at
         from feature_packages where id = $1`,
      [id],
    );
    return rows[0] ?? null;
  });
}

/** ברירות המחדל שכל התקנה מתחילה איתן — `PRESETS` הקבועים, הפוכים לשורות. */
const DEFAULT_PACKAGES: Array<{
  slug: string;
  name: string;
  description: string;
  modules: readonly string[];
}> = [
  { slug: 'documents', name: 'מסמכים בלבד', description: 'הדלת הכי רחבה לכניסה — קליטה, תיוק וחיפוש.', modules: PRESETS.documents },
  { slug: 'services', name: 'עסקי שירותים', description: 'עורכי דין, רו״ח, סוכנויות, יועצים — ריטיינר במרכז.', modules: PRESETS.services },
  { slug: 'commerce', name: 'עסקי מוצר B2B', description: 'יבואנים, מפיצים, ספקים — קטלוג, מלאי והזמנות.', modules: PRESETS.commerce },
  { slug: 'realestate', name: 'נדל״ן להשכרה', description: 'נכסים, חוזים, צ׳קים דחויים והחתמה.', modules: PRESETS.realestate },
  { slug: 'full', name: 'הכול', description: 'כל המודולים הקיימים במערכת.', modules: PRESETS.full },
];

/**
 * מוודא שברירות המחדל קיימות — בלי לדרוס עריכה שכבר נעשתה.
 *
 * **insert אם חסר, לעולם לא update.** אחרת מנהל שערך את השם של
 * "עסקי שירותים" ל"חבילת עורך דין 1" היה מגלה שהעריכה נמחקת בכניסה
 * הבאה שלו — אותה מלכודת בדיוק ש-`migrate()` נמנעת ממנה בכך שהיא
 * קדימה-בלבד. אידמפוטנטי וזול, ולכן קורא לזה `signInPlatform` בכל
 * התחברות (ADR-010) — מסד ייצור חדש מקבל את חמש ברירות המחדל בלי
 * שלב נפרד.
 */
export async function seedDefaultPackages(log: (m: string) => void = () => {}): Promise<number> {
  return withPlatform(async (tx) => {
    let created = 0;
    for (const p of DEFAULT_PACKAGES) {
      const inserted = await insertIfMissing(tx, p);
      if (inserted) {
        created++;
        log(`  ✓ חבילת ברירת מחדל: ${p.name}`);
      }
    }
    return created;
  });
}

async function insertIfMissing(
  tx: Tx,
  p: { slug: string; name: string; description: string; modules: readonly string[] },
): Promise<boolean> {
  const { rowCount } = await tx.query(
    `insert into feature_packages (slug, name, description, module_ids, is_template)
     values ($1, $2, $3, $4, true)
     on conflict (slug) do nothing`,
    [p.slug, p.name, p.description, p.modules],
  );
  return (rowCount ?? 0) > 0;
}
