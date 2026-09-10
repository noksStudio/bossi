import { DOC_TYPES, SOURCES } from '@bossi/db';
import { signFileUrl } from './file-signing';

/**
 * מפתחות דמו מוגשים מקבצים סטטיים; מפתחות `local:` (העלאות אמיתיות)
 * נפתרים לקישור חתום קצר-מועד דרך `/api/files` — ראו ADR-013.
 * `null` = אין קובץ להציג (מפתח לא מוכר, או שאין קובץ בכלל).
 */
export function documentUrl(storageKey: string, mime = 'application/pdf'): string | null {
  if (storageKey.startsWith('demo:')) return `/demo/${storageKey.slice(5)}`;
  if (storageKey.startsWith('local:')) return signFileUrl(storageKey.slice(6), mime);
  return null;
}

export function docTypeLabel(type: string | null): string {
  if (!type) return 'לא מסווג';
  return (DOC_TYPES as Record<string, string>)[type] ?? type;
}

export function sourceLabel(source: string): string {
  return (SOURCES as Record<string, string>)[source] ?? source;
}

export function formatBytes(bytes: string | number | null): string {
  const n = Number(bytes ?? 0);
  if (!n) return '—';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(value: Date | string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}

/** ימים עד לתפוגה. שלילי = כבר פג. */
export function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  const target = new Date(date);
  target.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - Date.now()) / 86_400_000);
}

export function expiryTone(days: number | null): 'danger' | 'warning' | 'neutral' | null {
  if (days === null) return null;
  if (days < 0) return 'danger';
  if (days <= 30) return 'warning';
  if (days <= 90) return 'neutral';
  return null;
}
