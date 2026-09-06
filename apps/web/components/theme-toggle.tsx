'use client';

import { useEffect, useState } from 'react';
import { THEME_KEY } from '@/lib/theme';

/**
 * מחזורי: בהיר → כהה → מערכת. "מערכת" היא מצב אמיתי ולא נגזרת —
 * מי שבוחר אותו מצפה שהמסך ישתנה איתו בערב.
 */
type Mode = 'light' | 'dark' | 'system';
const NEXT: Record<Mode, Mode> = { light: 'dark', dark: 'system', system: 'light' };
const LABEL: Record<Mode, string> = { light: 'מצב בהיר', dark: 'מצב כהה', system: 'לפי המערכת' };

function apply(mode: Mode) {
  const resolved =
    mode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode;
  document.documentElement.setAttribute('data-theme', resolved);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY) as Mode | null;
    setMode(stored ?? 'system');
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    apply(mode);
    if (mode === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, mode);

    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode, ready]);

  return (
    <button
      type="button"
      onClick={() => setMode((m) => NEXT[m])}
      title={LABEL[mode]}
      aria-label={`ערכת נושא: ${LABEL[mode]}. לחצו להחלפה.`}
      className="inline-flex size-9 items-center justify-center rounded-md border transition-colors"
      style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
    >
      {mode === 'dark' ? <MoonIcon /> : mode === 'light' ? <SunIcon /> : <AutoIcon />}
    </button>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const };

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" {...stroke}>
      <circle cx="10" cy="10" r="3.6" />
      <path d="M10 2v1.8M10 16.2V18M18 10h-1.8M3.8 10H2M15.7 4.3l-1.3 1.3M5.6 14.4l-1.3 1.3M15.7 15.7l-1.3-1.3M5.6 5.6L4.3 4.3" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" {...stroke}>
      <path d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z" />
    </svg>
  );
}
function AutoIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" {...stroke}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 3v14" />
      <path d="M10 3a7 7 0 0 1 0 14" fill="currentColor" stroke="none" opacity="0.55" />
    </svg>
  );
}
