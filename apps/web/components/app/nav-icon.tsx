import {
  Banknote, Bell, Boxes, Building, FileSignature, FileText, Gauge,
  Globe, HandCoins, Home, LayoutDashboard, Megaphone, PenTool, Receipt, Repeat,
  ScrollText, Search, ShoppingCart, Tag, Target, Users, type LucideIcon,
} from 'lucide-react';

/**
 * מיפוי בין שם האייקון שמודול מצהיר עליו (`NavEntry.icon`) לבין
 * הקומפוננטה בפועל. הקרנל לא יודע ש-lucide-react קיימת — מניפסט
 * מצהיר על מחרוזת בלבד, והפרשנות שלה היא עניין של האפליקציה.
 *
 * שם שלא נמצא כאן — למשל טעות הקלדה במניפסט — מרנדר כלום ולא זורק.
 * שורת ניווט בלי אייקון עדיפה על מסך שקורס בגלל מחרוזת שגויה.
 */
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Users, FileText, Search, Receipt, HandCoins, Repeat,
  Tag, Boxes, ShoppingCart, Globe, Bell, Gauge, Banknote, ScrollText,
  Building, FileSignature, PenTool, Home, Target, Megaphone,
};

export function NavIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = name ? ICONS[name] : undefined;
  if (!Icon) return null;
  // stroke דק ואחיד — לא "צועק" לצד הטקסט. הצבע עצמו לא נקבע כאן:
  // הוא יורש currentColor מהקישור שמסביב, ולכן זז יחד איתו ב-hover.
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}
