import Link from 'next/link';
import type { Alert, Severity } from '@bossi/core';

const TONE: Record<Severity, { bg: string; fg: string; label: string }> = {
  critical:  { bg: 'var(--danger-quiet)',  fg: 'var(--danger)',  label: 'דחוף' },
  attention: { bg: 'var(--warning-quiet)', fg: 'var(--warning)', label: 'לטפל' },
  info:      { bg: 'var(--surface-sunken)', fg: 'var(--text-muted)', label: 'לידיעה' },
};

export function AlertList({ alerts, limit }: { alerts: Alert[]; limit?: number }) {
  const shown = limit ? alerts.slice(0, limit) : alerts;

  if (shown.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-[0.88rem] text-muted">
        אין מה שדורש אותך. הכול מסודר.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-hairline">
      {shown.map((a) => {
        const tone = TONE[a.severity];
        return (
          <li key={a.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
            <span
              className="mt-0.5 w-[3.6rem] shrink-0 rounded-full px-2 py-0.5 text-center text-[0.66rem] font-medium"
              style={{ background: tone.bg, color: tone.fg }}
            >
              {tone.label}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.9rem] leading-snug">{a.title}</div>
              <div className="mt-0.5 text-[0.76rem] leading-relaxed text-muted">{a.detail}</div>
            </div>
            <Link
              href={a.href}
              className="shrink-0 rounded-sm border border-strong px-2.5 py-1 text-[0.72rem] text-secondary transition-colors hover:text-primary"
            >
              {a.action ?? 'פתח'}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
