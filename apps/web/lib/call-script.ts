/**
 * תסריט שיחה מודרך: עץ של צעדים. כל צעד = מה אומרים + מה יכול לקרות,
 * וכל תשובה מובילה לצעד הבא או לתוצאה שנרשמת על הליד. הטקסט כאן ולא
 * בקומפוננטה — כדי לחדד תסריט בלי לגעת בממשק. `{lead}` מוחלף בשם העסק.
 */

export type Outcome = 'meeting' | 'callback' | 'no_answer' | 'not_interested' | 'wrong_number';

export type StepId =
  | 'start' | 'secretary' | 'secretaryWhy' | 'ownerOpen' | 'notInterestedTry' | 'painQuestion'
  | 'painDebts' | 'painChecks' | 'painCredit' | 'painOrders' | 'painOwner'
  | 'offer' | 'objPrice' | 'objSend' | 'objBudget' | 'objWho' | 'objHasSystem';

export interface ScriptOption {
  label: string;
  next?: StepId;
  outcome?: Outcome;
  /** מה נרשם בהערה כשבוחרים בזה. בלי log — הבחירה לא נרשמת. */
  log?: string;
}

export interface ScriptStep {
  title: string;
  say: string[];
  tip?: string;
  options: ScriptOption[];
}

export const OUTCOME_LABELS: Record<Outcome, string> = {
  meeting: 'נקבעה פגישה',
  callback: 'לחזור אליו',
  no_answer: 'לא ענה',
  not_interested: 'לא מעוניין',
  wrong_number: 'מספר שגוי',
};

const OFFER_OPTIONS: ScriptOption[] = [
  { label: 'מסכים — קובעים פגישה', outcome: 'meeting' },
  { label: '"כמה זה עולה?"', next: 'objPrice', log: 'שאל על מחיר' },
  { label: '"תשלח לי משהו"', next: 'objSend', log: 'ביקש חומר' },
  { label: '"אין תקציב"', next: 'objBudget', log: 'התנגדות: תקציב' },
  { label: '"מי אתה בכלל?"', next: 'objWho', log: 'שאל מי אנחנו' },
  { label: '"אחשוב על זה" / "תחזור אליי"', outcome: 'callback', log: 'ביקש לחשוב' },
];

const AFTER_OBJECTION: ScriptOption[] = [
  { label: 'מסכים — קובעים פגישה', outcome: 'meeting' },
  { label: 'עוד לא — חזרה להצעה', next: 'offer' },
  { label: 'לחזור אליו בהמשך', outcome: 'callback' },
  { label: 'לא מעוניין', outcome: 'not_interested' },
];

function painStep(title: string, question: string): ScriptStep {
  return {
    title,
    say: [question, 'וכמה זה עלה לך בפעם האחרונה?'],
    tip: 'המספר שהוא אומר שווה יותר מכל מספר שתביא. רשום אותו.',
    options: [{ label: 'הלאה — הצעת אבחון', next: 'offer' }],
  };
}

export const CALL_SCRIPT: Record<StepId, ScriptStep> = {
  start: {
    title: 'מי ענה?',
    say: ['מחייגים ל{lead}.'],
    options: [
      { label: 'מזכירה / מוקד', next: 'secretary', log: 'ענתה מזכירה' },
      { label: 'הבעלים / המנהל', next: 'ownerOpen', log: 'ענה הבעלים' },
      { label: 'לא ענה / תא קולי', outcome: 'no_answer' },
      { label: 'מספר שגוי', outcome: 'wrong_number' },
    ],
  },
  secretary: {
    title: 'מזכירה',
    say: ['שלום, כאן יעקב אליה. אפשר לדבר עם מי שאחראי על הלקוחות וההזמנות — הבעלים או המנכ"ל?'],
    tip: 'לא מוכרים למזכירה. קצר, בטוח, בלי להתנצל.',
    options: [
      { label: 'מעבירה לבעלים', next: 'ownerOpen', log: 'הועבר לבעלים' },
      { label: 'שואלת "בנוגע למה?"', next: 'secretaryWhy' },
      { label: 'הבעלים לא זמין — לוקחת פרטים', outcome: 'callback', log: 'המזכירה לקחה פרטים' },
      { label: '"לא מעוניינים"', outcome: 'not_interested', log: 'נחסם במזכירה' },
    ],
  },
  secretaryWhy: {
    title: 'בנוגע למה?',
    say: ['אני עצמאי, בונה מערכות מותאמות אישית לבעלי עסקים — עוזר להם לעצור להתנהל באקסלים ובוואטסאפים. שתי דקות איתו, לא יותר.'],
    options: [
      { label: 'מעבירה לבעלים', next: 'ownerOpen', log: 'הועבר לבעלים' },
      { label: 'לוקחת פרטים לחזרה', outcome: 'callback', log: 'המזכירה לקחה פרטים' },
      { label: 'מסרבת', outcome: 'not_interested', log: 'נחסם במזכירה' },
    ],
  },
  ownerOpen: {
    title: 'פתיחה מול הבעלים',
    say: [
      'היי, כאן יעקב אליה. אני עצמאי, בונה מערכות מותאמות אישית לבעלי עסקים — בעיקר ליבואנים ומפיצים כאן באזור.',
      'אני לא מוכר לך כלום בטלפון — רק בודק אם זה רלוונטי. יש לך שתי דקות?',
    ],
    options: [
      { label: 'כן', next: 'painQuestion' },
      { label: '"אין לי זמן עכשיו"', outcome: 'callback', log: 'ביקש שנחזור בזמן אחר' },
      { label: '"לא מעוניין"', next: 'notInterestedTry', log: 'אמר לא מעוניין' },
    ],
  },
  notInterestedTry: {
    title: 'ניסיון אחד',
    say: ['בסדר גמור. רק שאלה אחת לפני שאני משחרר אותך — איך אתם מנהלים היום את הגבייה, מי חייב לכם כמה?'],
    tip: 'פעם אחת בלבד. אם עדיין לא — מנומס ויוצאים.',
    options: [
      { label: 'נפתח ומדבר', next: 'painQuestion' },
      { label: 'עדיין לא', outcome: 'not_interested' },
    ],
  },
  painQuestion: {
    title: 'שאלת הכאב',
    say: ['איך אתם עוקבים היום אחרי לקוחות, הזמנות ומי חייב כסף? באקסל, בוואטסאפ, בראש?'],
    tip: 'שואלים ושותקים. מה שהוא אומר עכשיו הוא כל הפיץ\'.',
    options: [
      { label: 'חובות / גבייה', next: 'painDebts', log: 'כאב: חובות וגבייה' },
      { label: 'צ\'קים', next: 'painChecks', log: 'כאב: צ\'קים' },
      { label: 'סחורה ללקוח בחריגה', next: 'painCredit', log: 'כאב: סחורה בחריגת אשראי' },
      { label: 'הזמנות בוואטסאפ', next: 'painOrders', log: 'כאב: הזמנות בוואטסאפ' },
      { label: 'הכל עובר דרכו', next: 'painOwner', log: 'כאב: הכל עובר דרכו' },
      { label: '"יש לנו כבר מערכת"', next: 'objHasSystem', log: 'יש לו מערכת' },
    ],
  },
  painDebts: painStep('חובות', 'אם אשאל אותך עכשיו מי שלושת החייבים הכי גדולים שלך — תוך כמה זמן תדע?'),
  painChecks: painStep('צ\'קים', 'מי אצלכם עוקב אחרי מועדי ההפקדה? מה קרה בפעם האחרונה שצ\'ק חזר?'),
  painCredit: painStep('חריגת אשראי', 'קרה שסחורה יצאה ללקוח שכבר היה בחריגה?'),
  painOrders: painStep('הזמנות', 'כמה פעמים ביום מתקשרים לשאול "מה עם ההזמנה"?'),
  painOwner: painStep('הכל עובר דרכו', 'אם אתה נעלם לשבועיים — מה נתקע?'),
  offer: {
    title: 'הצעת אבחון',
    say: [
      'בוא נקבע אבחון של 30 דקות — אני ממפה איתך איפה הולך כסף וזמן, ומראה לך איך זה נראה כשזה מסודר.',
      'גם אם לא נעבוד יחד, תצא עם תמונה ברורה. אני מנתניה — יכול לקפוץ אליך. מחר בבוקר או מחרתיים אחה"צ?',
    ],
    tip: 'תמיד שתי אפשרויות של זמן, לא "מתי נוח לך".',
    options: OFFER_OPTIONS,
  },
  objPrice: {
    title: 'כמה זה עולה?',
    say: ['תלוי בהיקף — בגדול הקמה סביב 30 אלף, ותחזוקה של 250 בחודש. אני מעדיף שתראה קודם מה אתה מקבל, ואז המספר מדבר בעד עצמו.'],
    options: AFTER_OBJECTION,
  },
  objSend: {
    title: 'תשלח לי משהו',
    say: ['בטח, אני שולח בוואטסאפ. אבל 20 דקות מול המסך מסבירות פי עשרה — בוא נקבע, ואחרי זה אשלח סיכום.'],
    tip: 'אם מתעקש: שולחים את הקישור לדף הנחיתה, וקובעים פולואפ.',
    options: AFTER_OBJECTION,
  },
  objBudget: {
    title: 'אין תקציב',
    say: ['מבין לגמרי. אז בלי שום התחייבות — תראה מה יש, ותחליט מתי זה נכון.'],
    options: AFTER_OBJECTION,
  },
  objWho: {
    title: 'מי אתה בכלל?',
    say: ['אני יעקב, עצמאי מנתניה. כל עסק מקבל ממני מערכת שנבנית בדיוק לאיך שהוא עובד, ואני מלווה אישית — לא חברת תוכנה עם מוקד.'],
    options: AFTER_OBJECTION,
  },
  objHasSystem: {
    title: 'יש לנו כבר מערכת',
    say: ['השאלה היא לא אם זה עובד — אלא כמה שעות בשבוע הולכות על להעביר מידע בין המערכת לאקסל ולוואטסאפ. תן לי 20 דקות, ואם זה לא רלוונטי — לא אתקשר שוב.'],
    options: AFTER_OBJECTION,
  },
};

/** הערת השיחה שנרשמת על הליד: המסלול שעבר + התוצאה. */
export function callSummary(path: readonly ScriptOption[], outcome: Outcome, detail?: string, extra?: string): string {
  const parts = ['שיחה מודרכת', ...path.map((o) => o.log).filter((l): l is string => Boolean(l))];
  parts.push(detail ? `${OUTCOME_LABELS[outcome]} ${detail}` : OUTCOME_LABELS[outcome]);
  const line = parts.join(' ← ');
  const note = extra?.trim();
  return note ? `${line}\n${note}` : line;
}
