/**
 * הטיפוסים של פלטפורמת המודולים.
 *
 * הכלל המרכזי: מודול לעולם לא מייבא מודול אחר. הוא מדבר איתו בשתי דרכים בלבד —
 *   1. אירועים (אסינכרוני, מנותק) — "קרה משהו", בלי לדעת מי מקשיב.
 *   2. פורטים (סינכרוני, מטופס) — "אני צריך יכולת", בלי לדעת מי מספק אותה.
 * הקרנל הוא היחיד שיודע מי מחובר למי, ולכן אפשר להרכיב כל תת-קבוצה של מודולים.
 */
import type { ZodTypeAny } from 'zod';

export type ModuleId = string;

// ---------------------------------------------------------------- פורטים

/** חוזה מטופס בין מודולים. `T` הוא הממשק שהספק מממש. */
export interface PortDef<T> {
  readonly id: string;
  /** נושא טיפוס בלבד — לא קיים בזמן ריצה. */
  readonly __type?: T;
}

export function definePort<T>(id: string): PortDef<T> {
  return { id };
}

/** מימוש של פורט שמודול מספק. */
export interface PortProvision<T = unknown> {
  readonly port: PortDef<T>;
  readonly factory: () => T;
}

// ---------------------------------------------------------------- אירועים

/**
 * סוג אירוע. חייב להיות `<namespace>.<name>`, כאשר namespace הוא מזהה המודול
 * שמייצר אותו (או `kernel`). האכיפה הזו מונעת מצב שבו מודול פולט אירועים
 * בשם של מודול אחר, וכך שוברת את יכולת ההרכבה.
 */
export type EventType = string;

export interface EventDef<P = unknown> {
  readonly type: EventType;
  readonly description: string;
  readonly payload?: ZodTypeAny;
  readonly __payload?: P;
}

export function defineEvent<P = unknown>(
  type: EventType,
  description: string,
  payload?: ZodTypeAny,
): EventDef<P> {
  return { type, description, payload };
}

export interface EventEnvelope<P = unknown> {
  readonly type: EventType;
  readonly tenantId: string;
  readonly occurredAt: Date;
  readonly customerId?: string;
  readonly subjectType?: string;
  readonly subjectId?: string;
  readonly payload: P;
}

export interface EventHandler {
  /** מזהה יציב — משמש ל-dedupe ולמעקב בתור העבודות. */
  readonly id: string;
  readonly on: EventType[];
  /** פעיל רק אם גם המודולים האלה דלוקים אצל אותו דייר. */
  readonly requires?: ModuleId[];
  readonly handle: (event: EventEnvelope, ctx: HandlerContext) => Promise<void> | void;
}

export interface HandlerContext {
  readonly tenantId: string;
  /** גישה לפורט. זורק אם המודול לא הכריז עליו ב-`consumes`. */
  readonly port: <T>(port: PortDef<T>) => T;
  readonly emit: (event: Omit<EventEnvelope, 'tenantId' | 'occurredAt'>) => Promise<void>;
  readonly settings: <S = unknown>() => S;
}

// ---------------------------------------------------------------- ממשק משתמש

/** נקודות עגינה שהקרנל מגדיר, ושמודולים נתלים עליהן. */
export type SlotId =
  | 'customer.tabs'
  | 'customer.overview.cards'
  | 'customer.timeline.renderers'
  | 'customer.actions'
  | 'dashboard.widgets'
  | 'search.filters'
  | 'settings.sections'
  | 'command.actions';

export interface SlotContribution {
  readonly slot: SlotId;
  readonly id: string;
  readonly order?: number;
  /** נדלק רק אם גם המודולים האלה פעילים — כך נבנית התנהגות משולבת בלי צימוד. */
  readonly requires?: ModuleId[];
  readonly component?: string;
  readonly label?: string;
  readonly permission?: string;
}

export interface NavEntry {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly icon?: string;
  readonly order?: number;
  readonly realm?: Realm;
  readonly permission?: string;
}

/** שני עולמות הזהות. לעולם לא מתמזגים — ראה CLAUDE.md כלל 2. */
export type Realm = 'staff' | 'portal';

// ---------------------------------------------------------------- עבודות

export interface JobDef {
  readonly id: string;
  /** cron, או `event` אם העבודה מופעלת מאירוע. */
  readonly schedule?: string;
  readonly description: string;
}

// ---------------------------------------------------------------- מודול

export type ModuleCategory = 'sales' | 'documents' | 'money' | 'commerce' | 'intelligence';

export interface ModuleManifest<S = unknown> {
  readonly id: ModuleId;
  readonly name: string;
  readonly description: string;
  readonly category: ModuleCategory;

  /** תלות קשיחה. בלעדיה המודול לא ניתן להפעלה. */
  readonly requires?: ModuleId[];
  /** תלות רכה — המודול עובד בלעדיה, אבל מרוויח ממנה. */
  readonly enhances?: ModuleId[];

  readonly provides?: PortProvision<any>[];
  readonly consumes?: PortDef<any>[];

  readonly emits?: EventDef<any>[];
  readonly handlers?: EventHandler[];

  readonly nav?: NavEntry[];
  readonly slots?: SlotContribution[];
  readonly jobs?: JobDef[];
  readonly permissions?: string[];

  /** סכמת ההגדרות פר-דייר. ה-UI של ההגדרות נגזר ממנה. */
  readonly settings?: ZodTypeAny;
  readonly defaultSettings?: S;

  /** טבלאות שהמודול הוא הבעלים שלהן. לתיעוד ולבדיקת בעלות — המיגרציות ב-@bossi/db. */
  readonly tables?: string[];
}
