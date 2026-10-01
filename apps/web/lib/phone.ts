/** ‎+972 9-887-3565 ו-09-8873565 הם אותו מספר — משווים ושומרים ספרות בלבד, עם 0 מוביל. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) digits = `0${digits.slice(3)}`;
  return digits || null;
}

/** קישור חיוג: ספרות ו-+ בלבד, כדי ש-"+972 9-887-3565" ו-"09-8873565" יחייגו שניהם. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** מספר ישראלי: נייח 9 ספרות או נייד 10, תמיד עם 0 מוביל. */
export function isIsraeliPhone(normalized: string | null): boolean {
  return normalized !== null && /^0\d{8,9}$/.test(normalized);
}
