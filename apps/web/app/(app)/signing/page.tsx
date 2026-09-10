import Link from 'next/link';
import { asPrincipal, listSigningRequests } from '@bossi/db';
import { requirePrincipal } from '@/lib/session';
import { StatTile, StatusPill } from '@/components/site/chrome';
import { formatDate } from '@/lib/documents';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'החתמות' };

/**
 * מי עוד לא חתם.
 *
 * ההבחנה שכל המסך עומד עליה: **"נשלח ולא נפתח" ו"נפתח ולא נחתם" הם
 * שני מצבים שונים לגמרי.** הראשון הוא בעיה טכנית — המייל נפל לספאם,
 * המספר שגוי. השני הוא החלטה — הוא קרא ומתלבט, ושיחת טלפון תפתור אותה.
 * מסך שמאחד את שניהם ל"ממתין" מוחק בדיוק את המידע שבגללו נכנסים אליו.
 */
export default async function SigningPage() {
  const principal = await requirePrincipal();
  const requests = await asPrincipal(principal, (tx) => listSigningRequests(tx, { limit: 80 }));

  const notOpened = requests.filter((r) => r.status === 'sent');
  const opened = requests.filter((r) => r.status === 'viewed');
  const closed = requests.filter((r) => ['signed', 'declined', 'expired', 'void'].includes(r.status));
  // חלון נע של 30 יום ולא "החודש הקלנדרי": ב-1 בחודש האחרון תמיד
  // מציג אפס, וזה נראה כמו תקלה ולא כמו תחילת חודש.
  const signedRecently = closed.filter(
    (r) => r.status === 'signed' && r.signed_at && Date.now() - new Date(r.signed_at).getTime() < 30 * 86_400_000,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.6rem]">החתמות</h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          {notOpened.length + opened.length === 0
            ? 'אין מסמכים שממתינים לחתימה.'
            : `${notOpened.length + opened.length} ממתינים לחתימה`}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="נשלח ולא נפתח" value={String(notOpened.length)} note="ייתכן שהקישור לא הגיע" />
        <StatTile label="נפתח ולא נחתם" value={String(opened.length)} note="קרא ומתלבט" />
        <StatTile label="נחתם" value={String(signedRecently.length)} note="30 הימים האחרונים" />
        <StatTile
          label="סירבו או פגו"
          value={String(closed.filter((r) => r.status !== 'signed').length)}
          note="דורש שליחה מחדש"
        />
      </div>

      <Group
        title="נפתח ולא נחתם"
        hint="הוא ראה את המסמך. שיחת טלפון קצרה שווה כאן יותר מתזכורת נוספת."
        requests={opened}
        empty="אין מסמך שנפתח וממתין."
      />

      <Group
        title="נשלח ולא נפתח"
        hint="הקישור עוד לא נלחץ. שווה לוודא שהמספר או המייל נכונים."
        requests={notOpened}
        empty="הכול נפתח."
      />

      {closed.length > 0 ? (
        <Group title="הסתיימו" hint="נחתמו, סורבו או פגו" requests={closed.slice(0, 20)} empty="" quiet />
      ) : null}
    </div>
  );
}

function Group({
  title, hint, requests, empty, quiet,
}: {
  title: string;
  hint: string;
  requests: Array<{
    id: string; customer_id: string; customer_name: string; title: string;
    signer_name: string; signer_phone: string | null; signer_email: string | null;
    status: string; sent_at: Date; expires_at: Date; viewed_at: Date | null;
    signed_at: Date | null; decline_reason: string | null; reminder_count: number;
  }>;
  empty: string;
  quiet?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-hairline">
      <header className="border-b border-hairline px-4 py-3">
        <h2 className="text-[0.98rem]">
          {title} <span className="tnum text-[0.8rem] text-muted">({requests.length})</span>
        </h2>
        <p className="mt-0.5 text-[0.76rem] text-muted">{hint}</p>
      </header>

      {requests.length === 0 ? (
        <p className="px-4 py-8 text-center text-[0.88rem] text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <StatusPill tone={tone(r.status)}>{LABELS[r.status] ?? r.status}</StatusPill>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.9rem]">{r.title}</div>
                <div className="text-[0.74rem] text-muted">
                  <Link href={`/customers/${r.customer_id}`} className="hover:underline">{r.signer_name}</Link>
                  {/* המפריד נשאר מחוץ ל-<bdi>: בתוך ריצה LTR הוא נודד לקצה
                      השני, והשם והטלפון נדבקים זה לזה. */}
                  {r.signer_phone ? <> · <bdi dir="ltr">{r.signer_phone}</bdi></> : null}
                  {' · '}
                  {timeline(r)}
                </div>
              </div>
              {!quiet ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button className="rounded-sm border border-strong px-2.5 py-1 text-[0.76rem] text-secondary transition-colors hover:bg-sunken">
                    שלח תזכורת
                  </button>
                  <button className="rounded-sm border border-strong px-2.5 py-1 text-[0.76rem] text-secondary transition-colors hover:bg-sunken">
                    העתק קישור
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const LABELS: Record<string, string> = {
  sent: 'נשלח', viewed: 'נפתח', signed: 'נחתם',
  declined: 'סירב', expired: 'פג', void: 'בוטל',
};

function tone(status: string): 'positive' | 'warning' | 'danger' | 'neutral' {
  if (status === 'signed') return 'positive';
  if (status === 'declined' || status === 'expired') return 'danger';
  if (status === 'viewed') return 'warning';
  return 'neutral';
}

function timeline(r: {
  status: string; sent_at: Date; expires_at: Date; viewed_at: Date | null;
  signed_at: Date | null; decline_reason: string | null; reminder_count: number;
}): string {
  if (r.status === 'signed' && r.signed_at) return `נחתם ${formatDate(r.signed_at)}`;
  if (r.status === 'declined') return r.decline_reason ?? 'סירב לחתום';
  if (r.status === 'expired') return `פג ב-${formatDate(r.expires_at)}`;
  if (r.status === 'viewed' && r.viewed_at) {
    const reminders = r.reminder_count > 0 ? ` · ${r.reminder_count} תזכורות` : '';
    return `נפתח ${formatDate(r.viewed_at)}${reminders}`;
  }
  const days = Math.round((Date.now() - new Date(r.sent_at).getTime()) / 86_400_000);
  return days === 0 ? 'נשלח היום' : `נשלח לפני ${days} ימים · פג ב-${formatDate(r.expires_at)}`;
}
