import { PLANS, PLAN_ORDER, type PlanId } from '@bossi/modules';

const EMPHASIS: PlanId = 'pro';

const nis = new Intl.NumberFormat('he-IL');

export function Pricing() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {PLAN_ORDER.map((id) => {
        const plan = PLANS[id];
        const featured = id === EMPHASIS;
        return (
          <div
            key={id}
            className="relative flex flex-col rounded-lg border p-6"
            style={{
              borderColor: featured ? 'var(--accent)' : 'var(--border-hairline)',
              background: featured ? 'var(--surface-raised)' : 'transparent',
            }}
          >
            {featured && (
              <span
                className="absolute -top-2.5 start-6 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium text-white"
                style={{ background: 'var(--accent)' }}
              >
                הנפוצה ביותר
              </span>
            )}

            <h3 className="text-xl">{plan.name}</h3>
            <p className="mt-1.5 min-h-10 text-[0.88rem] leading-relaxed text-secondary">{plan.tagline}</p>

            <div className="mt-5 flex items-baseline gap-1.5">
              {/* מספר ראשי: סנס ולא סריף, וספרות פרופורציונליות —
                  tabular-nums מרווח כל ספרה לרוחב אפס ונראה רופף בגודל תצוגה.
                  הוא שמור לעמודות מספרים שחייבות להתיישר. */}
              <span className="text-4xl font-semibold">{nis.format(plan.monthlyPrice)}</span>
              <span className="text-lg text-secondary">₪</span>
              <span className="text-sm text-muted">/ חודש</span>
            </div>
            <p className="mt-1 text-xs text-muted">לא כולל מע״מ ודמי הקמה חד-פעמיים</p>

            <ul className="mt-6 space-y-2.5 text-[0.9rem]">
              {plan.highlights.map((h) => (
                <li key={h} className="flex gap-2.5">
                  <CheckIcon />
                  <span className="leading-snug text-secondary">{h}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-6 mb-6 space-y-1.5 border-t border-hairline pt-4 text-[0.82rem]">
              <Row label="משתמשי צוות" value={fmtQuota(plan.quotas.seats.limit)} />
              <Row label="אחסון" value={`${fmtQuota(plan.quotas.storage_gb.limit)} GB`} />
              <Row label="מסמכים לחודש" value={fmtQuota(plan.quotas.documents_processed.limit)} />
              <Row label="מיילים לחודש" value={fmtQuota(plan.quotas.emails_sent.limit)} />
              <Row
                label="הודעות WhatsApp"
                value={plan.quotas.whatsapp_messages.limit === 0 ? '—' : fmtQuota(plan.quotas.whatsapp_messages.limit)}
              />
              <Row
                label="משתמשי פורטל"
                value={plan.quotas.portal_users.limit === 0 ? '—' : fmtQuota(plan.quotas.portal_users.limit)}
              />
            </dl>

            <a
              href="#contact"
              className="mt-auto pt-6 rounded-md py-2.5 text-center text-[0.9rem] font-medium transition-colors"
              style={
                featured
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }
              }
            >
              לבחור ב־{plan.name}
            </a>
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="tnum font-medium"><bdi>{value}</bdi></dd>
    </div>
  );
}

function fmtQuota(limit: number | null): string {
  return limit === null ? 'ללא הגבלה' : nis.format(limit);
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
      <path
        d="M3.5 8.4l3 3 6-6.8"
        stroke="var(--accent)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
