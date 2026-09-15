'use client';

/**
 * פותח את הקישור מיד (ברירת המחדל של קליק על `<a>`), ובמקביל — בלי
 * לחכות ולבלי לעצור את הניווט — מסמן שהלקוח יודע. אם הקריאה לשרת
 * נכשלת, ה-WhatsApp כבר נפתח; שורה שנשארה בלי `notified_at` פשוט
 * מופיעה שוב בפאנל "מוכן ליידוע" ואפשר ללחוץ שוב.
 */
export function WhatsAppReadyButton({
  href, lineId, markNotified,
}: {
  href: string;
  lineId: string;
  markNotified: (lineId: string) => Promise<void>;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => { void markNotified(lineId); }}
      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[0.78rem] font-medium text-white"
      style={{ background: '#25D366' }}
    >
      וואטסאפ ללקוח
    </a>
  );
}
