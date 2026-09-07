import { can, ROLE_LABELS, type Role } from '@bossi/core';
import type { NoteRow } from '@bossi/db';

/**
 * תיקיית הלקוח.
 *
 * המחיקה מוצגת רק לבעלים — אבל זו רק נימוס של הממשק. האכיפה האמיתית
 * היא מדיניות RESTRICTIVE במסד, כך שגם קריאה שעוקפת את המסך תיכשל.
 */
export function NotesPanel({
  notes,
  role,
  onAdd,
  onDelete,
}: {
  notes: NoteRow[];
  role: Role;
  onAdd: (formData: FormData) => Promise<void>;
  onDelete: (formData: FormData) => Promise<void>;
}) {
  const canDelete = role === 'owner';
  const canWrite = can(role, 'notes.write');

  return (
    <section className="rounded-lg border border-hairline">
      <header className="flex items-baseline justify-between border-b border-hairline px-4 py-3">
        <h2 className="text-[0.98rem]">תיקיית הלקוח</h2>
        <span className="text-[0.72rem] text-muted">
          {notes.length === 0 ? 'ריק' : notes.length === 1 ? 'רישום אחד' : `${notes.length} רישומים`}
        </span>
      </header>

      {canWrite ? (
        <form action={onAdd} className="border-b border-hairline p-3">
          <textarea
            name="body"
            required
            rows={2}
            placeholder="למשל: הועבר 2,000 במקום 2,200 בחודש מאי — נותרה יתרה"
            className="w-full resize-y rounded-md border border-strong bg-raised px-3 py-2 text-[0.88rem] outline-none"
          />
          <div className="mt-2 flex items-center gap-2.5">
            <button
              type="submit"
              className="rounded-md px-3.5 py-1.5 text-[0.85rem] font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              הוסף רישום
            </button>
            <label className="flex items-center gap-1.5 text-[0.78rem] text-secondary">
              <input type="checkbox" name="pinned" value="1" />
              הצמד למעלה
            </label>
          </div>
        </form>
      ) : null}

      {notes.length === 0 ? (
        <p className="px-4 py-6 text-[0.88rem] text-muted">
          עוד אין רישומים. כאן נרשמים הדברים שאין להם מקום אחר.
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {notes.map((n) => (
            <li key={n.id} className="px-4 py-3">
              {n.pinned ? (
                <span className="mb-1 inline-block text-[0.68rem]" style={{ color: 'var(--accent)' }}>
                  מוצמד
                </span>
              ) : null}
              <p className="whitespace-pre-wrap text-[0.88rem] leading-relaxed">{n.body}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[0.72rem] text-muted">
                <span>{n.author_name ?? 'לא ידוע'}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={new Date(n.created_at).toISOString()}>{when(n.created_at)}</time>
                {n.edited_at ? <span>· נערך</span> : null}
                {canDelete ? (
                  <form action={onDelete} className="ms-auto">
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className="text-[0.72rem] hover:underline" style={{ color: 'var(--danger)' }}>
                      מחק
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!canDelete && notes.length > 0 ? (
        <p className="border-t border-hairline px-4 py-2 text-[0.72rem] text-muted">
          רישומים נמחקים על ידי הבעלים בלבד. התפקיד שלך: {ROLE_LABELS[role]}.
        </p>
      ) : null}
    </section>
  );
}

function when(value: Date | string): string {
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days < 30) return `לפני ${days} ימים`;
  return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jerusalem' }).format(date);
}
