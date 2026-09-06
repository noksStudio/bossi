import { definePort } from '@bossi/kernel';

/**
 * החוזים בין המודולים. מודול צורך יכולת דרך פורט ולא מכיר את הספק —
 * ולכן אפשר להחליף מימוש, לכבות מודול, או להריץ תת-קבוצה בלי לשבור כלום.
 */

// -------------------------------------------------------------- מסמכים

export interface DocumentRef {
  id: string;
  filename: string;
  docType: string | null;
  createdAt: Date;
}

export interface Documents {
  forCustomer(customerId: string, opts?: { docType?: string; limit?: number }): Promise<DocumentRef[]>;
  /** מסמכים שמשמשים ראיה לישות מסוימת (חשבונית, הזמנה, תקופת ריטיינר). */
  evidenceFor(subjectType: string, subjectId: string): Promise<DocumentRef[]>;
  link(documentId: string, subjectType: string, subjectId: string): Promise<void>;
}
export const DocumentsPort = definePort<Documents>('documents.repository');

// -------------------------------------------------------------- חיפוש

export interface SearchHit {
  documentId: string;
  page: number | null;
  snippet: string;
  score: number;
}
export interface Search {
  query(tenantId: string, q: string, scope?: { customerId?: string }): Promise<SearchHit[]>;
  index(documentId: string): Promise<void>;
}
export const SearchPort = definePort<Search>('search.engine');

// -------------------------------------------------------------- כסף

/** מקור חיוב פולימורפי — תקופת ריטיינר, הזמנה, או כל דבר עתידי. */
export interface BillableSource {
  sourceType: string;
  sourceId: string;
  customerId: string;
  description: string;
  amount: string;
  currency: string;
}

export interface Invoicing {
  issue(source: BillableSource): Promise<{ invoiceId: string; externalId: string | null }>;
}
export const InvoicingPort = definePort<Invoicing>('billing.invoicing');

export interface AgeBuckets {
  current: string;
  d1to30: string;
  d31to60: string;
  d61to90: string;
  over90: string;
}
export interface Receivables {
  balanceFor(customerId: string): Promise<string>;
  openInvoices(customerId: string): Promise<Array<{ invoiceId: string; amount: string; dueOn: Date }>>;
  aging(customerId?: string): Promise<AgeBuckets>;
  /** ממוצע ימי איחור וסטיית תקן — הבסיס לתעדוף גבייה לפי חריגה. */
  paymentBehaviour(customerId: string): Promise<{ avgDaysLate: number; stdDev: number; sample: number }>;
}
export const ReceivablesPort = definePort<Receivables>('billing.receivables');

// -------------------------------------------------------------- מסחר

export interface Pricing {
  priceFor(customerId: string, productId: string, qty: number): Promise<{ unit: string; currency: string }>;
}
export const PricingPort = definePort<Pricing>('catalog.pricing');

export interface Availability {
  /** available = on_hand − allocated + incoming_confirmed */
  availableToPromise(productId: string): Promise<number>;
  allocate(productId: string, qty: number, orderId: string): Promise<void>;
  release(orderId: string): Promise<void>;
}
export const AvailabilityPort = definePort<Availability>('inventory.availability');

// -------------------------------------------------------------- התראות

export interface Alerts {
  raise(input: {
    tenantId: string;
    kind: string;
    customerId?: string;
    severity: 'info' | 'attention' | 'urgent';
    title: string;
    body?: string;
    actions?: Array<{ id: string; label: string }>;
  }): Promise<void>;
}
export const AlertsPort = definePort<Alerts>('alerts.sink');
