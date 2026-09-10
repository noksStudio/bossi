import { randomBytes } from 'node:crypto';
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

// ── CRUD ─────────────────────────────────────────────────────────────────
//
// שם, תיאור ורשימת מודולים — זה כל מה שאדמין עורך. `slug` אינו נחשף
// בטופס בכלל: הוא מזהה פנימי בלבד (הזריעה למעלה היא היחידה שבאמת
// זקוקה לו כדי להיות אידמפוטנטית), ולכן נוצר כאן אוטומטית ולא נדרש
// שם עברי יתעקם לכתובת URL.

function randomSlug(): string {
  return `pkg-${randomBytes(5).toString('hex')}`;
}

export async function createFeaturePackage(input: {
  name: string;
  description?: string | null;
  moduleIds: string[];
  isTemplate?: boolean;
}): Promise<string> {
  const { rows } = await withPlatform((tx) =>
    tx.query<{ id: string }>(
      `insert into feature_packages (slug, name, description, module_ids, is_template)
       values ($1, $2, $3, $4, coalesce($5, true))
       returning id`,
      [randomSlug(), input.name, input.description ?? null, input.moduleIds, input.isTemplate ?? null],
    ),
  );
  return rows[0]!.id;
}

export async function updateFeaturePackage(
  id: string,
  input: { name: string; description?: string | null; moduleIds: string[]; isTemplate: boolean },
): Promise<boolean> {
  const { rowCount } = await withPlatform((tx) =>
    tx.query(
      `update feature_packages
          set name = $2, description = $3, module_ids = $4, is_template = $5, updated_at = now()
        where id = $1`,
      [id, input.name, input.description ?? null, input.moduleIds, input.isTemplate],
    ),
  );
  return (rowCount ?? 0) > 0;
}

/** שכפול — נקודת ההתחלה של "חבילת עורך דין 2" מתוך "חבילת עורך דין 1". */
export async function duplicateFeaturePackage(id: string, name: string): Promise<string | null> {
  const source = await getFeaturePackage(id);
  if (!source) return null;
  return createFeaturePackage({
    name,
    description: source.description,
    moduleIds: source.module_ids,
    isTemplate: source.is_template,
  });
}

export async function deleteFeaturePackage(id: string): Promise<boolean> {
  const { rowCount } = await withPlatform((tx) => tx.query('delete from feature_packages where id = $1', [id]));
  return (rowCount ?? 0) > 0;
}

// ── החלה על דייר ─────────────────────────────────────────────────────────

/**
 * מחליפה את כל המודולים הפעילים של הדייר באלה שבחבילה — לא מוסיפה
 * מעליהם. חבילה היא הרכב הבסיס; מה שהאדמין מוסיף או מוריד אחרי זה
 * ידנית (במסך הדייר הקיים) הוא סטייה מתועדת מהחבילה, לא עריכה שלה —
 * ולכן ה"החלה" עצמה חייבת לקבוע נקודת התחלה נקייה ולא רק לצרף.
 *
 * טרנזקציה אחת: אין מצב ביניים שבו חלק מהמודולים כבר הוחלפו וחלק לא.
 */
export async function applyFeaturePackageToTenant(tenantId: string, packageId: string): Promise<boolean> {
  const pkg = await getFeaturePackage(packageId);
  if (!pkg) return false;

  await withPlatform(async (tx) => {
    await tx.query(
      `update tenant_modules
          set enabled = false, disabled_at = now()
        where tenant_id = $1 and enabled = true and not (module_id = any($2::text[]))`,
      [tenantId, pkg.module_ids],
    );
    for (const moduleId of pkg.module_ids) {
      await tx.query(
        `insert into tenant_modules (tenant_id, module_id, enabled)
         values ($1, $2, true)
         on conflict (tenant_id, module_id) do update
           set enabled = true,
               enabled_at = case when tenant_modules.enabled then tenant_modules.enabled_at else now() end,
               disabled_at = null`,
        [tenantId, moduleId],
      );
    }
  });
  return true;
}
