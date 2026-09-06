import { defineEvent, type ModuleManifest } from '@bossi/kernel';
import { z } from 'zod';
import {
  AlertsPort,
  AvailabilityPort,
  DocumentsPort,
  InvoicingPort,
  PricingPort,
  ReceivablesPort,
  SearchPort,
} from './ports.js';
import { stubPort } from './stub.js';

// ══════════════════════════════════════════════════════════ מסמכים

export const documents: ModuleManifest = {
  id: 'documents',
  name: 'מסמכים',
  description: 'קליטה מכל ערוץ, סיווג, תיוק אוטומטי ומעקב תוקף.',
  category: 'documents',
  provides: [{ port: DocumentsPort, factory: () => stubPort(DocumentsPort) }],
  emits: [
    defineEvent('documents.received', 'מסמך נקלט מערוץ כלשהו'),
    defineEvent('documents.classified', 'המסמך סווג לסוג'),
    defineEvent('documents.filed', 'המסמך תויק וקושר ללקוח'),
    defineEvent('documents.needs_review', 'ביטחון הסיווג נמוך מהסף — נדרש אישור אנושי'),
    defineEvent('documents.expiring', 'תוקף המסמך עומד לפוג'),
    defineEvent('documents.expired', 'תוקף המסמך פג'),
  ],
  nav: [{ id: 'documents', label: 'מסמכים', href: '/documents', order: 20, realm: 'staff' }],
  slots: [
    { slot: 'customer.tabs', id: 'documents.tab', label: 'מסמכים', order: 20 },
    { slot: 'customer.overview.cards', id: 'documents.expiring_card', label: 'מסמכים שפג תוקפם', order: 30 },
    { slot: 'settings.sections', id: 'documents.intake', label: 'ערוצי קליטה', order: 20 },
  ],
  jobs: [
    { id: 'documents.poll_inbox', schedule: '*/5 * * * *', description: 'משיכת מיילים נכנסים' },
    { id: 'documents.expiry_scan', schedule: '0 6 * * *', description: 'סריקת תוקף יומית' },
  ],
  permissions: ['documents.read', 'documents.write', 'documents.review'],
  settings: z.object({
    intakeEmail: z.string().email().optional(),
    autoFileThreshold: z.number().min(0).max(1).default(0.85),
    expiryWarnDays: z.array(z.number().int().positive()).default([60, 30, 7]),
  }),
  tables: ['documents', 'document_versions', 'document_links', 'document_extractions'],
};

// ══════════════════════════════════════════════════════════ חיפוש

export const search: ModuleManifest = {
  id: 'search',
  name: 'חיפוש',
  description: 'חיפוש היברידי — לקסיקלי, סמנטי ומובנה — עם ציטוט מהמקור.',
  category: 'intelligence',
  // תלות רכה: החיפוש עובד גם בלי מסמכים (הזמנות, לקוחות), ומרוויח מהם.
  enhances: ['documents'],
  provides: [{ port: SearchPort, factory: () => stubPort(SearchPort) }],
  emits: [defineEvent('search.indexed', 'פריט נוסף לאינדקס')],
  handlers: [
    {
      id: 'search.index_filed_document',
      on: ['documents.filed'],
      requires: ['documents'], // נדלק רק אם מודול המסמכים פעיל אצל הדייר
      handle: async () => {},
    },
  ],
  nav: [{ id: 'search', label: 'חיפוש', href: '/search', order: 10, realm: 'staff' }],
  slots: [{ slot: 'command.actions', id: 'search.ask', label: 'שאל שאלה', order: 10 }],
  permissions: ['search.query'],
  settings: z.object({
    semantic: z.boolean().default(true),
    citationsRequired: z.boolean().default(true),
  }),
  tables: ['chunks'],
};

// ══════════════════════════════════════════════════════════ חיוב

export const billing: ModuleManifest = {
  id: 'billing',
  name: 'חיוב וחשבוניות',
  description: 'חשבוניות, תקבולים ויתרות. ההנפקה עצמה מואצלת לספק חיצוני.',
  category: 'money',
  provides: [
    { port: InvoicingPort, factory: () => stubPort(InvoicingPort) },
    { port: ReceivablesPort, factory: () => stubPort(ReceivablesPort) },
  ],
  emits: [
    defineEvent('billing.invoice_issued', 'הונפקה חשבונית'),
    defineEvent('billing.invoice_due_soon', 'חשבונית מתקרבת למועד הפירעון'),
    defineEvent('billing.invoice_overdue', 'חשבונית עברה את מועד הפירעון'),
    defineEvent('billing.payment_received', 'התקבל תשלום'),
    defineEvent('billing.payment_failed', 'תשלום נכשל'),
  ],
  nav: [{ id: 'billing', label: 'חיוב', href: '/billing', order: 30, realm: 'staff' }],
  slots: [
    { slot: 'customer.tabs', id: 'billing.tab', label: 'כספים', order: 30 },
    { slot: 'customer.overview.cards', id: 'billing.balance_card', label: 'יתרה', order: 10 },
    { slot: 'dashboard.widgets', id: 'billing.aging', label: 'אייג\'ינג', order: 10 },
  ],
  jobs: [{ id: 'billing.overdue_scan', schedule: '0 7 * * *', description: 'סימון חשבוניות באיחור' }],
  permissions: ['billing.read', 'billing.write'],
  settings: z.object({
    provider: z.enum(['morning', 'rivhit', 'icount', 'none']).default('none'),
    defaultTermsDays: z.number().int().min(0).default(30),
    currency: z.string().default('ILS'),
  }),
  tables: ['invoices', 'payments', 'payment_allocations'],
};

// ══════════════════════════════════════════════════════════ גבייה

export const collections: ModuleManifest = {
  id: 'collections',
  name: 'גבייה',
  description: 'תעדוף לפי חריגה, סולם דחיפה, הבטחות תשלום ולינקי תשלום.',
  category: 'money',
  requires: ['billing'],
  enhances: ['documents'],
  consumes: [ReceivablesPort],
  emits: [
    defineEvent('collections.reminder_sent', 'נשלחה תזכורת'),
    defineEvent('collections.promise_made', 'לקוח הבטיח לשלם בתאריך'),
    defineEvent('collections.promise_broken', 'הבטחת תשלום הופרה'),
    defineEvent('collections.escalated', 'התיק הוסלם'),
    defineEvent('collections.paused', 'הגבייה מהלקוח הושהתה ידנית'),
  ],
  handlers: [
    { id: 'collections.on_overdue', on: ['billing.invoice_overdue'], handle: async () => {} },
    { id: 'collections.on_payment', on: ['billing.payment_received'], handle: async () => {} },
  ],
  nav: [{ id: 'collections', label: 'גבייה', href: '/collections', order: 40, realm: 'staff' }],
  slots: [
    { slot: 'dashboard.widgets', id: 'collections.priority_list', label: 'על מי להתקשר היום', order: 5 },
    { slot: 'customer.actions', id: 'collections.send_reminder', label: 'שלח תזכורת', order: 10 },
    // ── זו נקודת החיבור בין המודולים: "גבייה עם ראיות" מופיעה
    //    רק אם גם מודול המסמכים פעיל אצל אותו דייר.
    {
      slot: 'customer.actions',
      id: 'collections.reminder_with_evidence',
      label: 'תזכורת + צירוף ראיות',
      order: 11,
      requires: ['documents'],
    },
  ],
  jobs: [{ id: 'collections.dunning_run', schedule: '0 9 * * 0-4', description: 'סבב סולם דחיפה' }],
  permissions: ['collections.read', 'collections.send', 'collections.pause'],
  settings: z.object({
    ladder: z
      .array(z.object({ offsetDays: z.number().int(), channel: z.enum(['email', 'whatsapp', 'sms']), tone: z.enum(['soft', 'neutral', 'firm']) }))
      .default([
        { offsetDays: -3, channel: 'email', tone: 'soft' },
        { offsetDays: 1, channel: 'whatsapp', tone: 'soft' },
        { offsetDays: 7, channel: 'whatsapp', tone: 'neutral' },
        { offsetDays: 30, channel: 'email', tone: 'firm' },
      ]),
    attachEvidence: z.boolean().default(true),
    requireApprovalBeforeSend: z.boolean().default(true),
  }),
  tables: ['dunning_runs', 'promises_to_pay', 'collection_pauses'],
};

// ══════════════════════════════════════════════════════════ ריטיינרים

export const retainers: ModuleManifest = {
  id: 'retainers',
  name: 'ריטיינרים',
  description: 'תקופות, ספר צריכה, תחזית שחיקה, תעריף שעה אפקטיבי וראדאר חידושים.',
  category: 'money',
  requires: ['billing'],
  consumes: [InvoicingPort],
  emits: [
    defineEvent('retainers.period_opened', 'נפתחה תקופת ריטיינר'),
    defineEvent('retainers.consumed', 'נרשמה צריכה'),
    defineEvent('retainers.threshold_crossed', 'נחצה סף ניצול'),
    defineEvent('retainers.overrun', 'חריגה מהמכסה'),
    defineEvent('retainers.renewal_due', 'מתקרב מועד ההודעה המוקדמת לחידוש'),
    defineEvent('retainers.price_stale', 'המחיר לא עודכן זמן רב'),
    defineEvent('retainers.period_closed', 'התקופה נסגרה ומוכנה לחיוב'),
  ],
  handlers: [
    // סגירת תקופה מייצרת מקור חיוב — billing מנפיק, בלי שהמודולים מכירים זה את זה.
    { id: 'retainers.bill_closed_period', on: ['retainers.period_closed'], handle: async () => {} },
  ],
  nav: [{ id: 'retainers', label: 'ריטיינרים', href: '/retainers', order: 25, realm: 'staff' }],
  slots: [
    { slot: 'customer.tabs', id: 'retainers.tab', label: 'ריטיינר', order: 15 },
    { slot: 'customer.overview.cards', id: 'retainers.burn_card', label: 'שחיקת ריטיינר', order: 5 },
    { slot: 'dashboard.widgets', id: 'retainers.burn_forecast', label: 'תחזית שחיקה', order: 20 },
    { slot: 'dashboard.widgets', id: 'retainers.renewal_radar', label: 'ראדאר חידושים', order: 30 },
  ],
  jobs: [
    { id: 'retainers.open_periods', schedule: '0 1 1 * *', description: 'פתיחת תקופות חודשיות' },
    { id: 'retainers.burn_scan', schedule: '0 8 * * *', description: 'בדיקת שחיקה ותחזית' },
  ],
  permissions: ['retainers.read', 'retainers.write', 'retainers.log_consumption'],
  settings: z.object({
    quotaUnit: z.enum(['hours', 'items', 'scope']).default('hours'),
    burnAlertThresholds: z.array(z.number().min(0).max(2)).default([0.8, 1.0]),
    priceStaleMonths: z.number().int().positive().default(18),
  }),
  tables: ['retainers', 'retainer_periods', 'consumption_entries'],
};

// ══════════════════════════════════════════════════════════ קטלוג

export const catalog: ModuleManifest = {
  id: 'catalog',
  name: 'קטלוג ומחירונים',
  description: 'מוצרים, מחירון בסיס, מחיר פר-לקוח והנחות כמות.',
  category: 'commerce',
  provides: [{ port: PricingPort, factory: () => stubPort(PricingPort) }],
  emits: [
    defineEvent('catalog.product_created', 'נוצר מוצר'),
    defineEvent('catalog.price_changed', 'מחיר השתנה'),
  ],
  nav: [{ id: 'catalog', label: 'קטלוג', href: '/catalog', order: 50, realm: 'staff' }],
  slots: [{ slot: 'customer.tabs', id: 'catalog.prices_tab', label: 'מחירון הלקוח', order: 40 }],
  permissions: ['catalog.read', 'catalog.write', 'catalog.pricing'],
  settings: z.object({ defaultCurrency: z.string().default('ILS'), showListPrice: z.boolean().default(false) }),
  tables: ['products', 'price_lists', 'price_list_items', 'customer_prices'],
};

// ══════════════════════════════════════════════════════════ מלאי

export const inventory: ModuleManifest = {
  id: 'inventory',
  name: 'מלאי',
  description: 'מלאי זמין להבטחה, הקצאה, ספי חוסר וסנכרון ERP.',
  category: 'commerce',
  requires: ['catalog'],
  provides: [{ port: AvailabilityPort, factory: () => stubPort(AvailabilityPort) }],
  emits: [
    defineEvent('inventory.low', 'מלאי מתחת לסף'),
    defineEvent('inventory.out', 'מלאי אזל'),
    defineEvent('inventory.synced', 'הסתיים סנכרון מול מערכת חיצונית'),
  ],
  nav: [{ id: 'inventory', label: 'מלאי', href: '/inventory', order: 55, realm: 'staff' }],
  slots: [{ slot: 'dashboard.widgets', id: 'inventory.low_stock', label: 'מלאי בסיכון', order: 40 }],
  jobs: [{ id: 'inventory.erp_sync', schedule: '*/15 * * * *', description: 'סנכרון מלאי מול ERP' }],
  permissions: ['inventory.read', 'inventory.write'],
  settings: z.object({
    allowBackorder: z.boolean().default(false),
    erp: z.enum(['hashavshevet', 'priority', 'rivhit', 'none']).default('none'),
  }),
  tables: ['inventory_levels', 'inventory_allocations', 'inventory_movements'],
};

// ══════════════════════════════════════════════════════════ הזמנות

export const orders: ModuleManifest = {
  id: 'orders',
  name: 'הזמנות',
  description: 'עגלה, הזמנה, אשראי ותנאי תשלום, והזמנה חוזרת חכמה.',
  category: 'commerce',
  requires: ['catalog', 'billing'],
  enhances: ['inventory'],
  consumes: [PricingPort, InvoicingPort],
  emits: [
    defineEvent('orders.placed', 'הוגשה הזמנה'),
    defineEvent('orders.approved', 'ההזמנה אושרה'),
    defineEvent('orders.rejected', 'ההזמנה נדחתה'),
    defineEvent('orders.shipped', 'ההזמנה נשלחה'),
    defineEvent('orders.reorder_due', 'הגיע הזמן להזמנה חוזרת לפי דפוס הלקוח'),
  ],
  handlers: [
    // הקצאת מלאי קורית רק אם מודול המלאי פעיל — אחרת ההזמנה פשוט נרשמת.
    { id: 'orders.allocate_stock', on: ['orders.placed'], requires: ['inventory'], handle: async () => {} },
    { id: 'orders.release_stock', on: ['orders.rejected'], requires: ['inventory'], handle: async () => {} },
  ],
  nav: [{ id: 'orders', label: 'הזמנות', href: '/orders', order: 60, realm: 'staff' }],
  slots: [
    { slot: 'customer.tabs', id: 'orders.tab', label: 'הזמנות', order: 35 },
    { slot: 'dashboard.widgets', id: 'orders.reorder_due', label: 'הזמנות חוזרות', order: 25 },
  ],
  jobs: [{ id: 'orders.reorder_scan', schedule: '0 8 * * 0-4', description: 'זיהוי דפוסי הזמנה חוזרת' }],
  permissions: ['orders.read', 'orders.write', 'orders.approve'],
  settings: z.object({
    blockOnOverdue: z.boolean().default(true),
    blockOnCreditLimit: z.boolean().default(true),
    allowManualOverride: z.boolean().default(true),
  }),
  tables: ['orders', 'order_lines', 'carts'],
};

// ══════════════════════════════════════════════════════════ פורטל

export const portal: ModuleManifest = {
  id: 'portal',
  name: 'פורטל לקוחות',
  description: 'ממשק לצד הלקוח. מציג רק את מה שהמודולים הפעילים מספקים.',
  category: 'commerce',
  // בכוונה בלי תלות קשיחה: אפשר פורטל מסמכים בלבד, פורטל חיוב, או פורטל מסחר מלא.
  enhances: ['orders', 'documents', 'billing'],
  emits: [
    defineEvent('portal.user_invited', 'הוזמן משתמש פורטל'),
    defineEvent('portal.user_signed_in', 'משתמש פורטל התחבר'),
  ],
  nav: [
    { id: 'portal.admin', label: 'פורטל', href: '/settings/portal', order: 70, realm: 'staff' },
    { id: 'portal.home', label: 'ראשי', href: '/p', order: 10, realm: 'portal' },
    { id: 'portal.documents', label: 'המסמכים שלי', href: '/p/documents', order: 20, realm: 'portal' },
    { id: 'portal.orders', label: 'הזמנות', href: '/p/orders', order: 30, realm: 'portal' },
    { id: 'portal.invoices', label: 'חשבוניות', href: '/p/invoices', order: 40, realm: 'portal' },
  ],
  slots: [
    { slot: 'settings.sections', id: 'portal.users', label: 'משתמשי פורטל', order: 30 },
    { slot: 'customer.tabs', id: 'portal.access_tab', label: 'גישה לפורטל', order: 50 },
  ],
  permissions: ['portal.manage', 'portal.invite'],
  settings: z.object({
    modules: z.array(z.enum(['documents', 'orders', 'invoices'])).default(['documents']),
    requireApprovalFlow: z.boolean().default(false),
  }),
  tables: ['portal_users', 'portal_sessions', 'portal_invitations'],
};

// ══════════════════════════════════════════════════════════ התראות

export const alerts: ModuleManifest = {
  id: 'alerts',
  name: 'התראות',
  description: 'מנוע חוקים מעל זרם האירועים, ודייג\'סט בוקר של שלושה דברים.',
  category: 'intelligence',
  provides: [{ port: AlertsPort, factory: () => stubPort(AlertsPort) }],
  emits: [
    defineEvent('alerts.raised', 'נוצרה התראה'),
    defineEvent('alerts.dismissed', 'התראה נדחתה'),
    defineEvent('alerts.digest_sent', 'נשלח דייג\'סט'),
  ],
  handlers: [
    { id: 'alerts.money_at_risk', on: ['billing.invoice_overdue', 'billing.payment_failed'], requires: ['billing'], handle: async () => {} },
    { id: 'alerts.commitment_at_risk', on: ['retainers.overrun', 'retainers.renewal_due', 'retainers.price_stale'], requires: ['retainers'], handle: async () => {} },
    { id: 'alerts.document_at_risk', on: ['documents.expiring', 'documents.expired'], requires: ['documents'], handle: async () => {} },
    { id: 'alerts.stock_at_risk', on: ['inventory.low', 'inventory.out'], requires: ['inventory'], handle: async () => {} },
    { id: 'alerts.promise_broken', on: ['collections.promise_broken'], requires: ['collections'], handle: async () => {} },
  ],
  nav: [{ id: 'alerts', label: 'התראות', href: '/alerts', order: 15, realm: 'staff' }],
  slots: [{ slot: 'dashboard.widgets', id: 'alerts.digest', label: 'הבוקר שלך', order: 1 }],
  jobs: [{ id: 'alerts.morning_digest', schedule: '0 7 * * 0-4', description: 'דייג\'סט בוקר' }],
  permissions: ['alerts.read', 'alerts.configure'],
  settings: z.object({
    digestChannel: z.enum(['email', 'whatsapp', 'none']).default('email'),
    digestHour: z.number().int().min(0).max(23).default(7),
    maxDigestItems: z.number().int().positive().default(3),
    pushKinds: z.array(z.string()).default(['orders.placed', 'billing.payment_failed']),
  }),
  tables: ['alert_rules', 'alerts', 'alert_deliveries'],
};

export const ALL_MODULES = [
  documents,
  search,
  billing,
  collections,
  retainers,
  catalog,
  inventory,
  orders,
  portal,
  alerts,
] satisfies ModuleManifest[];
