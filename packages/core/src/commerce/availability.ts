import { toAgorot, type Agorot } from '../shared/money';

/**
 * מלאי זמין להבטחה, ושער האישור של הזמנה.
 *
 * **מה שבמחסן אינו מה שאפשר להבטיח.** הזמנה שאושרה כבר לקחה סחורה
 * שעוד לא יצאה. פורטל שמראה `on_hand` מבטיח פעמיים את אותו פריט,
 * והלקוח השני מגלה את זה רק כשהמשאית לא מגיעה.
 */

export interface StockLike {
  on_hand: string | number;
  allocated: string | number;
  reorder_point: string | number;
  lead_days?: number;
}

export type StockStatus = 'out' | 'critical' | 'low' | 'ok';

export const STOCK_LABELS: Record<StockStatus, string> = {
  out: 'אזל',
  critical: 'מתחת לסף',
  low: 'מתקרב לסף',
  ok: 'תקין',
};

export function availableToPromise(level: StockLike): number {
  return num(level.on_hand) - num(level.allocated);
}

export function stockStatus(level: StockLike): StockStatus {
  const atp = availableToPromise(level);
  const reorder = num(level.reorder_point);
  if (atp <= 0) return 'out';
  if (reorder > 0 && atp <= reorder) return 'critical';
  if (reorder > 0 && atp <= reorder * 1.5) return 'low';
  return 'ok';
}

export const STOCK_RANK: Record<StockStatus, number> = { out: 0, critical: 1, low: 2, ok: 3 };

// ── הזמנות ────────────────────────────────────────────────────────────────

export interface OrderLineLike {
  quantity: string | number;
  unit_price: string | number;
}

export interface OrderTotals {
  net: Agorot;
  vat: Agorot;
  gross: Agorot;
  units: number;
}

export function orderTotals(lines: OrderLineLike[], vatRate = 0.18): OrderTotals {
  // כל שורה מעוגלת לאגורה בפני עצמה, ואז מסכמים. הסדר ההפוך יוצר
  // הפרש של אגורה מול החשבונית שהלקוח מקבל — וזו שיחת טלפון מיותרת.
  const net = lines.reduce((total, l) => total + Math.round(toAgorot(l.unit_price) * num(l.quantity)), 0);
  const vat = Math.round(net * vatRate);
  return { net, vat, gross: net + vat, units: lines.reduce((t, l) => t + num(l.quantity), 0) };
}

export type OrderGate = 'approve' | 'hold_credit' | 'hold_overdue' | 'hold_stock';

export const GATE_LABELS: Record<OrderGate, string> = {
  approve: 'מוכן לאישור',
  hold_credit: 'חורג ממסגרת אשראי',
  hold_overdue: 'חוב פתוח באיחור',
  hold_stock: 'אין מלאי זמין',
};

/**
 * האם מותר לאשר את ההזמנה.
 *
 * הסדר קובע: מסגרת אשראי לפני חוב, וחוב לפני מלאי. מלאי הוא בעיה
 * שנפתרת בהזמנה מהספק; אשראי הוא בעיה שנפתרת רק בהחלטה של בעל העסק,
 * ולכן היא זו שצריכה להופיע.
 */
export function orderGate(input: {
  orderGross: Agorot;
  openBalance: Agorot;
  overdueBalance: Agorot;
  creditLimit?: Agorot | null;
  blockOnOverdue?: boolean;
  linesShort?: number;
}): { gate: OrderGate; detail: string } {
  const limit = input.creditLimit ?? null;
  if (limit !== null && limit > 0 && input.openBalance + input.orderGross > limit) {
    const over = input.openBalance + input.orderGross - limit;
    return { gate: 'hold_credit', detail: `חריגה של ${money(over)} ₪ ממסגרת האשראי` };
  }
  if ((input.blockOnOverdue ?? true) && input.overdueBalance > 0) {
    return { gate: 'hold_overdue', detail: `${money(input.overdueBalance)} ₪ פתוחים באיחור` };
  }
  if ((input.linesShort ?? 0) > 0) {
    return { gate: 'hold_stock', detail: `${input.linesShort} פריטים ללא מלאי זמין` };
  }
  return { gate: 'approve', detail: '' };
}

const num = (v: string | number) => (typeof v === 'number' ? v : Number(v || 0));
const money = (agorot: Agorot) => new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(agorot / 100);
