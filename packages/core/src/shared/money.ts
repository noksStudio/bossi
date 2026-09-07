/**
 * כסף באגורות שלמות.
 *
 * המסד מחזיר numeric כמחרוזת בכוונה (ראה `client.ts`), והחישובים כאן
 * עובדים על מספרים שלמים. `0.1 + 0.2 !== 0.3` הוא באג מצחיק בבלוג
 * ובאג יקר בדוח גבייה.
 */

export type Agorot = number;

export function toAgorot(value: string | number | null | undefined): Agorot {
  if (value === null || value === undefined || value === '') return 0;
  const text = String(value).trim();
  const negative = text.startsWith('-');
  const [whole = '0', fraction = ''] = text.replace(/^-/, '').split('.');
  const cents = Number(`${whole}${(fraction + '00').slice(0, 2)}`);
  if (!Number.isFinite(cents)) return 0;
  return negative ? -cents : cents;
}

export function toShekels(agorot: Agorot): string {
  const negative = agorot < 0;
  const abs = Math.abs(Math.round(agorot));
  const text = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}

export function formatILS(agorot: Agorot, opts: { decimals?: boolean } = {}): string {
  const value = agorot / 100;
  return new Intl.NumberFormat('he-IL', {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  }).format(value);
}

export const sum = (values: Agorot[]): Agorot => values.reduce((a, b) => a + b, 0);
