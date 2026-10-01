import { useEffect } from 'react';

/**
 * נועל את גלילת הדף מאחורי חלון קופץ. ב-iOS `overflow: hidden` על ה-body
 * לבדו לא עוצר גלילה במגע, ולכן ה-body מקובע (`position: fixed`) במקום
 * שבו הוא עומד, וחוזר לאותה נקודה בסגירה. חלון בתוך חלון לא נועל שוב —
 * הנעילה החיצונית כבר מחזיקה, והשחרור שלה הוא שמחזיר את המקום.
 */
export function useScrollLock(): void {
  useEffect(() => {
    const style = document.body.style;
    if (style.position === 'fixed') return;
    const y = window.scrollY;
    const previous = { position: style.position, top: style.top, width: style.width, overflow: style.overflow };
    style.position = 'fixed';
    style.top = `-${y}px`;
    style.width = '100%';
    style.overflow = 'hidden';
    return () => {
      Object.assign(style, previous);
      window.scrollTo(0, y);
    };
  }, []);
}
