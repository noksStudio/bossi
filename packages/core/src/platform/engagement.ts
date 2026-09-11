/**
 * מעורבות דייר — לא ניתוח שימוש כללי, אלא סיווג פעולתי: מי כדאי
 * לבקש ממנו המלצה, ומי כדאי להציע לו הדרכה לפני שהוא עוזב.
 *
 * שני אותות בלבד, במשקל שווה בכוונה: כניסות למערכת ופעולות אנוש
 * (שיתוף, יצירה, גבייה — כל דבר עם `actor_type = 'user'` בזרם
 * האירועים, לא אירועי מערכת/רקע). המשתמש אישר במפורש ששניהם "טובים"
 * באותה מידה — אין כאן משקל אחד שגובר על השני.
 *
 * לא AI, לא ניחוש — ספירה דטרמיניסטית על חלון זמן קבוע (שכבת הנתונים
 * קובעת את החלון, הפונקציה הזו רק מסווגת מספרים שכבר נספרו).
 */

export type EngagementTier = 'power' | 'engaged' | 'at_risk' | 'dormant';

export const ENGAGEMENT_LABELS: Record<EngagementTier, string> = {
  power: 'פעיל חזק',
  engaged: 'פעיל',
  at_risk: 'בסיכון נטישה',
  dormant: 'רדום',
};

/** מה כדאי לעשות עם דייר בכל שכבה — לא נשלח אוטומטית, רק מוצע. */
export const ENGAGEMENT_SUGGESTIONS: Record<EngagementTier, string> = {
  power: 'לבקש המלצה או עדות',
  engaged: 'להמשיך לעקוב',
  at_risk: 'להציע שיחת הדרכה',
  dormant: 'ליצור קשר לפני שהוא עוזב',
};

export interface EngagementInput {
  /** כניסות למערכת בחלון הזמן (kernel.user_signed_in). */
  logins: number;
  /** פעולות אנוש אחרות בחלון הזמן — לא כניסות, לא אירועי מערכת. */
  actions: number;
}

export interface Engagement {
  score: number;
  tier: EngagementTier;
}

/**
 * ספי הסיווג נגזרים מחלון של 14 יום (נקבע בשכבת הנתונים): "פעיל חזק"
 * הוא בערך שימוש כמעט-יומי, "בסיכון" הוא כמעט כלום. אלה ספים ראשוניים
 * שמיועדים להתכוונן מול נתונים אמיתיים — לא נוסחה שמורה מספרות קדושה.
 */
const THRESHOLDS: Record<Exclude<EngagementTier, 'dormant'>, number> = {
  at_risk: 1,
  engaged: 5,
  power: 20,
};

export function classifyEngagement(input: EngagementInput): Engagement {
  const score = input.logins + input.actions;

  let tier: EngagementTier;
  if (score >= THRESHOLDS.power) tier = 'power';
  else if (score >= THRESHOLDS.engaged) tier = 'engaged';
  else if (score >= THRESHOLDS.at_risk) tier = 'at_risk';
  else tier = 'dormant';

  return { score, tier };
}
