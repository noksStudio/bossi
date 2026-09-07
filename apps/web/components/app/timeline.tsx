import { describeEvent, type EventDef } from '@bossi/kernel';
import type { StoredEvent } from '@bossi/db';

/**
 * ציר הזמן של הלקוח.
 *
 * התוויות אינן מקודדות כאן: כל מודול כבר מכריז על האירועים שלו עם תיאור
 * בעברית ב-`emits`, וציר הזמן מתרגם דרך הקטלוג של ההרכבה. מודול חדש
 * מקבל תווית בחינם, ומודול כבוי לא משאיר אחריו טקסט מיותם.
 */
export function Timeline({
  events,
  catalog,
}: {
  events: StoredEvent[];
  catalog: EventDef[];
}) {
  if (events.length === 0) {
    return (
      <p className="py-6 text-[0.88rem] text-muted">
        עוד לא קרה כלום עם הלקוח הזה. ברגע שיכנס מסמך או תירשם פעולה, הכל יופיע כאן.
      </p>
    );
  }

  return (
    <ol className="space-y-0">
      {events.map((event, i) => (
        <li key={event.id} className="flex gap-3.5">
          {/* קו רציף בין הנקודות — מה שהופך רשימה לציר */}
          <div className="flex shrink-0 flex-col items-center pt-1.5">
            <span
              className="size-1.5 rounded-full"
              style={{ background: toneOf(event.type) }}
              aria-hidden="true"
            />
            {i < events.length - 1 ? (
              <span className="mt-1 w-px flex-1 bg-hairline" aria-hidden="true" />
            ) : null}
          </div>

          <div className="min-w-0 flex-1 pb-5">
            <div className="text-[0.9rem] leading-snug">
              {describeEvent(event.type, catalog) ?? event.type}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.72rem] text-muted">
              <time dateTime={new Date(event.occurred_at).toISOString()}>
                {formatWhen(event.occurred_at)}
              </time>
              {event.actor_type === 'system' ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>אוטומטי</span>
                </>
              ) : null}
            </div>
            <PayloadDetails payload={event.payload} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** מציג רק שדות שיש בהם ערך לקורא. `source: seed` לא מעניין אף אחד. */
function PayloadDetails({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload ?? {}).filter(
    ([k, v]) => v !== null && v !== '' && !['source', 'modules'].includes(k),
  );
  if (entries.length === 0) return null;

  return (
    <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[0.72rem]">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-1.5">
          <dt className="text-muted">{FIELD_LABELS[k] ?? k}</dt>
          <dd>{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

const FIELD_LABELS: Record<string, string> = {
  plan: 'חבילה',
  amount: 'סכום',
  field: 'שדה',
  from: 'מ־',
  to: 'ל־',
  name: 'שם',
  role: 'תפקיד',
};

/** סוגי אירועים שמסמנים סיכון מקבלים נקודה צבועה. השאר עמומים. */
function toneOf(type: string): string {
  if (/overdue|overrun|expired|broken|failed|out$/.test(type)) return 'var(--danger)';
  if (/due_soon|expiring|threshold|renewal|low$/.test(type)) return 'var(--warning)';
  if (/payment_received|filed|approved|kept/.test(type)) return 'var(--positive)';
  return 'var(--border-strong)';
}

function formatWhen(when: Date | string): string {
  const date = new Date(when);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days < 30) return `לפני ${days} ימים`;
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).format(date);
}
