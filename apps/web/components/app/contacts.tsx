import type { Contact } from '@bossi/db';

/**
 * ב-B2B מי שמזמין, מי שמאשר ומי שמשלם הם כמעט תמיד שלושה אנשים שונים.
 * זה לא פרט טכני — זו הסיבה שתזכורת גבייה שנשלחת "ללקוח" לא מגיעה
 * למי שבאמת משלם.
 */
const ROLE_LABELS: Record<string, string> = {
  orders: 'מזמין',
  approves: 'מאשר',
  pays: 'משלם',
  legal: 'משפטי',
};

export function ContactList({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return <p className="py-4 text-[0.88rem] text-muted">אין עדיין אנשי קשר.</p>;
  }

  return (
    <ul className="divide-y divide-hairline">
      {contacts.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
          <span className="font-medium">{c.name}</span>
          {c.is_primary ? (
            <span className="text-[0.68rem] text-muted">ראשי</span>
          ) : null}
          <span className="flex gap-1">
            {c.roles.map((r) => (
              <span
                key={r}
                className="rounded-sm px-1.5 py-0.5 text-[0.68rem]"
                style={{ background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}
              >
                {ROLE_LABELS[r] ?? r}
              </span>
            ))}
          </span>
          <span className="ms-auto flex flex-wrap gap-x-3 text-[0.78rem] text-muted">
            {c.email ? (
              <a href={`mailto:${c.email}`} dir="ltr" className="hover:text-primary">
                {c.email}
              </a>
            ) : null}
            {c.phone ? (
              <a href={`tel:${c.phone}`} dir="ltr" className="hover:text-primary">
                {c.phone}
              </a>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
