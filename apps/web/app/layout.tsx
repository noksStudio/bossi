import type { Metadata, Viewport } from 'next';
import { Frank_Ruhl_Libre, Heebo } from 'next/font/google';
import { themeScript } from '@/lib/theme';
import './globals.css';

/*
  טיפוגרפיה: פרנק-רי"ל לכותרות — סריף עברי עם שורשים אמיתיים, שנותן
  סמכות של מסמך ולא של אפליקציה. חיבו לממשק — נקי ומצוין במידות קטנות.
*/
const frank = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-frank',
  display: 'swap',
});

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-heebo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Bossi — מערכת הפעלה לעסק', template: '%s · Bossi' },
  description:
    'ניהול לקוחות, ריטיינרים, מסמכים וגבייה על ציר זמן אחד. כל שקל שמגיע לכם, וכל מסמך שמוכיח אותו, במקום אחד.',
  openGraph: {
    title: 'Bossi — מערכת הפעלה לעסק',
    description: 'גבייה עם ראיות, ריטיינרים בלי שחיקה, ומסמכים שמוצאים את עצמם.',
    locale: 'he_IL',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f4' },
    { media: '(prefers-color-scheme: dark)', color: '#0e161d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${frank.variable} ${heebo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
