import type { ModuleCategory } from '@bossi/kernel';
import { ALL_MODULES } from '@bossi/modules';

const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  documents: 'מסמכים', money: 'כספים', commerce: 'מסחר', intelligence: 'בינה',
};
const CATEGORY_ORDER: ModuleCategory[] = ['documents', 'money', 'commerce', 'intelligence'];

/**
 * טופס חבילה — משותף ליצירה ולעריכה. שרת בלבד: הצ'קבוקסים נשלחים
 * דרך `FormData` רגיל (`modules` חוזר כמערך מ-`getAll`), בלי JS בצד
 * הלקוח.
 *
 * מקובץ לפי קטגוריית המודול (documents/money/commerce/intelligence,
 * כבר מוצהר על כל מניפסט) — 14 תיבות ברשימה שטוחה קשות לסרוק, ארבע
 * קבוצות קלות.
 */
export function PackageForm({
  action, defaultName, defaultDescription, defaultModuleIds, defaultIsTemplate, submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultName?: string;
  defaultDescription?: string | null;
  defaultModuleIds?: string[];
  defaultIsTemplate?: boolean;
  submitLabel: string;
}) {
  const checked = new Set(defaultModuleIds ?? []);
  const byCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    modules: ALL_MODULES.filter((m) => m.category === cat),
  }));

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-[0.8rem] text-secondary">שם החבילה</label>
        <input
          id="name" name="name" required defaultValue={defaultName}
          placeholder="חבילת עורך דין 1"
          className="mt-1 w-full max-w-md rounded-md border border-hairline bg-transparent px-3 py-2 text-[0.9rem]"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-[0.8rem] text-secondary">תיאור</label>
        <textarea
          id="description" name="description" rows={2} defaultValue={defaultDescription ?? ''}
          placeholder="למי מתאימה החבילה הזו ומה מיוחד בה"
          className="mt-1 w-full max-w-md rounded-md border border-hairline bg-transparent px-3 py-2 text-[0.86rem]"
        />
      </div>

      <div>
        <span className="block text-[0.8rem] text-secondary">מודולים</span>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          {byCategory.map(({ category, modules }) => (
            <fieldset key={category} className="rounded-md border border-hairline p-3">
              <legend className="px-1 text-[0.74rem] text-muted">{CATEGORY_LABELS[category]}</legend>
              <ul className="space-y-1.5">
                {modules.map((m) => (
                  <li key={m.id}>
                    <label className="flex items-start gap-2 text-[0.85rem]">
                      <input
                        type="checkbox" name="modules" value={m.id} defaultChecked={checked.has(m.id)}
                        className="mt-0.5"
                      />
                      <span>{m.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-[0.85rem]">
        <input type="checkbox" name="isTemplate" defaultChecked={defaultIsTemplate ?? true} />
        <span>תבנית לשימוש חוזר — מוצעת כבסיס בכל הקמת דייר</span>
      </label>
      <p className="text-[0.74rem] text-muted">
        לבטל אם זו הרכבה חד-פעמית ללקוח אחד בלבד — למשל "ייחודי איציק כהן". החבילה עדיין
        תישאר קיימת לעריכה, רק לא תוצע כברירת מחדל למישהו אחר.
      </p>

      <button
        type="submit"
        className="rounded-md px-4 py-2 text-[0.88rem] font-medium transition-opacity hover:opacity-90"
        style={{ background: 'var(--text-primary)', color: 'var(--surface)' }}
      >
        {submitLabel}
      </button>
    </form>
  );
}
