/** ימים עד תאריך. שלילי = כבר עבר. מנוטרל משעות כדי שלא יזוז בין בקשות. */
export function daysUntilDate(value: Date | string, today = new Date()): number {
  const target = startOfDay(new Date(value));
  return Math.round((target.getTime() - startOfDay(today).getTime()) / 86_400_000);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
