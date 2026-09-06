/**
 * הסימן של Bossi: שלושה פסים בתוך מסגרת — מסמכים מתויקים בסדר.
 * הפס האמצעי בולט מעט: הדבר שדורש טיפול, שמערכת טובה מציפה.
 */
export function BossiMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="1.25"
        y="1.25"
        width="29.5"
        height="29.5"
        rx="7.5"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.9"
      />
      <rect x="8" y="9" width="16" height="2.75" rx="1.375" fill="currentColor" opacity="0.45" />
      <rect x="8" y="14.6" width="16" height="2.75" rx="1.375" fill="var(--accent)" />
      <rect x="8" y="20.2" width="10" height="2.75" rx="1.375" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function BossiWordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <BossiMark />
      <span
        className="text-[1.35rem] leading-none tracking-tight"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
      >
        Bossi
      </span>
    </span>
  );
}
