import { defineEvent, type EventDef } from './types';

/**
 * אירועי הקרנל — אלה שאינם שייכים לשום מודול.
 *
 * מודולים מכריזים על האירועים שלהם ב-`emits` עם תיאור בעברית, ולכן ציר
 * הזמן יכול לתרגם כל סוג אירוע לשפת בני אדם בלי מנגנון נוסף: הוא מחפש
 * בקטלוג של ההרכבה, ונופל לכאן עבור אירועי הקרנל.
 *
 * המשמעות: מודול חדש שמוסיף אירוע מקבל תווית בציר הזמן בחינם, ובלבד
 * שהתיאור שלו נכתב כמשפט שאפשר להראות למשתמש.
 */
export const KERNEL_EVENTS: EventDef[] = [
  defineEvent('kernel.tenant_created', 'העסק נוצר ב-Bossi'),
  defineEvent('kernel.user_signed_in', 'משתמש צוות נכנס למערכת'),
  defineEvent('kernel.customer_created', 'הלקוח נוסף'),
  defineEvent('kernel.customer_updated', 'פרטי הלקוח עודכנו'),
  defineEvent('kernel.customer_archived', 'הלקוח הועבר לארכיון'),
  defineEvent('kernel.contact_added', 'נוסף איש קשר'),
  defineEvent('kernel.contact_removed', 'איש קשר הוסר'),
  defineEvent('kernel.note_added', 'נרשמה הערה'),
];

/** תרגום סוג אירוע לתיאור קריא. `null` כשהסוג אינו מוכר. */
export function describeEvent(type: string, catalog: EventDef[] = []): string | null {
  return (
    catalog.find((e) => e.type === type)?.description ??
    KERNEL_EVENTS.find((e) => e.type === type)?.description ??
    null
  );
}
