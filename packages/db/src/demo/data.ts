/**
 * תוכן הדמו.
 *
 * שני עסקים אמיתיים למראה, כי דמו נופל ברגע שרואים "לקוח 1" ו-"מסמך 3".
 * הכל דטרמיניסטי (PRNG עם זרע קבוע) כדי שאפשר יהיה לחזור על אותה הדגמה
 * פעמיים ולדעת מראש מה יופיע.
 */

export interface DemoContact {
  name: string;
  roles: string[];
  email?: string;
  phone?: string;
  primary?: boolean;
}

export interface DemoCustomer {
  name: string;
  legal?: string;
  businessId?: string;
  status?: 'active' | 'prospect' | 'dormant';
  terms: number;
  creditLimit?: string;
  tags: string[];
  contacts: DemoContact[];
  /** צפיפות המסמכים. גבוה = לקוח ותיק ופעיל. */
  weight: number;
  /** ימים מאז המגע האחרון. מעל 60 → הלקוח "נשכח". */
  quietDays?: number;
  notes?: string;
}

export const SERVICES_CUSTOMERS: DemoCustomer[] = [
  {
    name: 'דני כהן — סטודיו',
    legal: 'ד. כהן עיצוב בע״מ',
    businessId: '515993027',
    terms: 30,
    tags: ['ריטיינר', 'ותיק'],
    weight: 9,
    notes: 'ריטיינר חודשי מאז 2023. סוכם בעל פה על הרחבה לרבעון הבא — לעגן בכתב.',
    contacts: [
      { name: 'דני כהן', roles: ['approves', 'pays'], email: 'dani@cohen-studio.co.il', phone: '052-555-1234', primary: true },
      { name: 'שירה אלון', roles: ['orders'], email: 'shira@cohen-studio.co.il' },
    ],
  },
  {
    name: 'נורית ברק — ייעוץ אסטרטגי',
    legal: 'נ. ברק ייעוץ בע״מ',
    businessId: '514668219',
    terms: 45,
    tags: ['ריטיינר'],
    weight: 7,
    contacts: [{ name: 'נורית ברק', roles: ['orders', 'approves', 'pays'], email: 'nurit@barak.co.il', phone: '054-772-9910', primary: true }],
  },
  {
    name: 'מעבדות תבל בע״מ',
    legal: 'מעבדות תבל תעשיות בע״מ',
    businessId: '512883004',
    terms: 60,
    creditLimit: '120000.00',
    tags: ['ריטיינר', 'תאגיד'],
    weight: 10,
    contacts: [
      { name: 'עו״ד רון אלפרין', roles: ['approves'], email: 'ron@tevel-labs.com', primary: true },
      { name: 'מיכל דגן', roles: ['orders'], email: 'michal@tevel-labs.com' },
      { name: 'הנהלת חשבונות', roles: ['pays'], email: 'ap@tevel-labs.com' },
    ],
  },
  {
    name: 'אורלי שגב — אדריכלות',
    legal: 'א. שגב אדריכלים בע״מ',
    businessId: '516004417',
    terms: 30,
    tags: ['פרויקטלי'],
    weight: 5,
    contacts: [{ name: 'אורלי שגב', roles: ['orders', 'approves', 'pays'], email: 'orly@segev-arch.co.il', primary: true }],
  },
  {
    name: 'גלעד מזרחי הפקות',
    businessId: '039114772',
    terms: 30,
    tags: ['עוסק מורשה'],
    weight: 4,
    quietDays: 74,
    contacts: [{ name: 'גלעד מזרחי', roles: ['orders', 'pays'], phone: '050-311-4772', primary: true }],
  },
  {
    name: 'קליניקת רימון',
    legal: 'רימון רפואה משלימה בע״מ',
    businessId: '515220017',
    terms: 30,
    tags: ['ריטיינר'],
    weight: 6,
    contacts: [
      { name: 'ד״ר יעל רימון', roles: ['approves'], email: 'yael@rimon-clinic.co.il', primary: true },
      { name: 'משרד', roles: ['orders', 'pays'], email: 'office@rimon-clinic.co.il' },
    ],
  },
  {
    name: 'ש. אלמוג ובניו בע״מ',
    businessId: '511204889',
    terms: 60,
    creditLimit: '80000.00',
    tags: ['תאגיד', 'ותיק'],
    weight: 8,
    contacts: [
      { name: 'שמעון אלמוג', roles: ['approves'], primary: true },
      { name: 'ליאור אלמוג', roles: ['orders'], email: 'lior@almog-sons.co.il' },
    ],
  },
  {
    name: 'טכנוסופט פתרונות',
    legal: 'טכנוסופט פתרונות תוכנה בע״מ',
    businessId: '515771118',
    terms: 45,
    tags: ['ריטיינר', 'הייטק'],
    weight: 7,
    contacts: [{ name: 'איתי גרוס', roles: ['orders', 'approves'], email: 'itay@technosoft.io', primary: true }],
  },
  {
    name: 'עמותת שער לקהילה',
    legal: 'שער לקהילה (ע״ר)',
    businessId: '580441209',
    terms: 30,
    tags: ['מלכ״ר'],
    weight: 4,
    quietDays: 96,
    contacts: [{ name: 'רחל אבידן', roles: ['orders', 'approves', 'pays'], email: 'rachel@shaar.org.il', primary: true }],
  },
  {
    name: 'בית קפה לוינסקי',
    status: 'prospect',
    terms: 30,
    tags: ['ליד'],
    weight: 1,
    contacts: [{ name: 'עומר לוינסקי', roles: ['orders'], phone: '053-880-1145', primary: true }],
  },
];

export const COMMERCE_CUSTOMERS: DemoCustomer[] = [
  {
    name: 'מוסך הצפון',
    legal: 'מוסך הצפון (2011) בע״מ',
    businessId: '514330117',
    terms: 60,
    creditLimit: '80000.00',
    tags: ['לקוח קבוע', 'אשראי'],
    weight: 10,
    contacts: [
      { name: 'איציק לוי', roles: ['orders'], phone: '052-440-1177', primary: true },
      { name: 'מירי שגב', roles: ['approves'], email: 'miri@hatzafon-garage.co.il' },
      { name: 'הנהלת חשבונות', roles: ['pays'], email: 'ap@hatzafon-garage.co.il' },
    ],
  },
  {
    name: 'אלקטרו רם',
    legal: 'אלקטרו רם מערכות בע״מ',
    businessId: '512009445',
    terms: 30,
    creditLimit: '25000.00',
    tags: ['לקוח קבוע'],
    weight: 8,
    contacts: [{ name: 'רם ביטון', roles: ['orders', 'approves', 'pays'], email: 'ram@electro-ram.co.il', primary: true }],
  },
  {
    name: 'מרכז הברגים חיפה',
    businessId: '511889334',
    terms: 45,
    creditLimit: '40000.00',
    tags: ['מפיץ משנה'],
    weight: 9,
    contacts: [
      { name: 'ניסים חדד', roles: ['orders'], phone: '04-855-2210', primary: true },
      { name: 'הנהלת חשבונות', roles: ['pays'], email: 'finance@bragim-haifa.co.il' },
    ],
  },
  {
    name: 'י. פרידמן מתכות',
    legal: 'י. פרידמן מתכות ובניו בע״מ',
    businessId: '510442287',
    terms: 60,
    creditLimit: '150000.00',
    tags: ['תאגיד', 'ותיק'],
    weight: 10,
    contacts: [
      { name: 'יורם פרידמן', roles: ['approves'], primary: true },
      { name: 'רכש', roles: ['orders'], email: 'purchasing@friedman-metals.co.il' },
      { name: 'כספים', roles: ['pays'], email: 'ap@friedman-metals.co.il' },
    ],
  },
  { name: 'סוללות אורן', businessId: '514772003', terms: 30, creditLimit: '18000.00', tags: ['קמעונאי'], weight: 5,
    contacts: [{ name: 'אורן שפירא', roles: ['orders', 'pays'], phone: '050-772-0031', primary: true }] },
  { name: 'טכנו-אור תאורה', legal: 'טכנו-אור תאורה בע״מ', businessId: '515338811', terms: 45, creditLimit: '35000.00', tags: ['לקוח קבוע'], weight: 7,
    contacts: [{ name: 'ענת כרמי', roles: ['orders', 'approves'], email: 'anat@techno-or.co.il', primary: true }] },
  { name: 'מוסך אבו-חמד', businessId: '033889221', terms: 30, tags: ['עוסק מורשה'], weight: 4, quietDays: 68,
    contacts: [{ name: 'סאמר אבו-חמד', roles: ['orders', 'pays'], phone: '052-889-2210', primary: true }] },
  { name: 'קירור השרון', legal: 'קירור השרון בע״מ', businessId: '512776004', terms: 60, creditLimit: '60000.00', tags: ['לקוח קבוע'], weight: 8,
    contacts: [
      { name: 'דודי נחמיאס', roles: ['orders'], primary: true },
      { name: 'חשבות', roles: ['pays'], email: 'ap@keirur-hasharon.co.il' },
    ] },
];

/** תבניות כותרת לכל סוג מסמך. `#` מוחלף במספר רץ. */
export const DOC_TEMPLATES: Record<
  string,
  { titles: string[]; expiryMonths?: number; hasAmount?: boolean; weight: number }
> = {
  contract:       { titles: ['חוזה שירותים חתום', 'הסכם התקשרות', 'נספח להסכם — הרחבת היקף'], expiryMonths: 24, weight: 2 },
  quote:          { titles: ['הצעת מחיר #', 'הצעת מחיר מעודכנת #', 'הצעה לפרויקט #'], hasAmount: true, weight: 4 },
  invoice:        { titles: ['חשבונית מס #', 'חשבונית מס-קבלה #'], hasAmount: true, weight: 6 },
  receipt:        { titles: ['קבלה #'], hasAmount: true, weight: 3 },
  delivery_note:  { titles: ['תעודת משלוח #', 'תעודת משלוח חתומה #'], weight: 5 },
  tax_exemption:  { titles: ['אישור ניכוי מס במקור', 'אישור ניהול ספרים'], expiryMonths: 12, weight: 1 },
  insurance:      { titles: ['אישור קיום ביטוחים'], expiryMonths: 12, weight: 1 },
  bank_guarantee: { titles: ['ערבות בנקאית #'], expiryMonths: 18, hasAmount: true, weight: 1 },
  meeting_notes:  { titles: ['סיכום פגישה', 'סיכום שיחת טלפון', 'סיכום פגישת סטטוס'], weight: 3 },
  correspondence: { titles: ['תכתובת מייל — ', 'התכתבות בנושא '], weight: 2 },
};

export const CORRESPONDENCE_SUBJECTS = [
  'לוחות זמנים', 'שינוי היקף', 'תנאי תשלום', 'בקשה להארכה', 'אישור מסירה', 'הערות לטיוטה',
];
