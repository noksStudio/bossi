import type { Tx } from './client';

/**
 * תיקיית הלקוח.
 *
 * הערה יכולה לעמוד על הלקוח או להיצמד לצ'ק, לחוזה או למסמך.
 * המחיקה נאכפת במסד (מיגרציה 0007) ושמורה לבעלים — הפונקציה כאן
 * לא בודקת הרשאה, היא פשוט תיכשל אם אין.
 */

export interface NoteRow {
  id: string;
  customer_id: string | null;
  subject_type: string | null;
  subject_id: string | null;
  body: string;
  author_id: string | null;
  author_name: string | null;
  pinned: boolean;
  created_at: Date;
  edited_at: Date | null;
}

const SELECT = `
  select n.id, n.customer_id, n.subject_type, n.subject_id, n.body,
         n.author_id, u.name as author_name, n.pinned, n.created_at, n.edited_at
    from notes n
    left join users u on u.id = n.author_id
`;

export async function listNotes(
  tx: Tx,
  opts: { customerId?: string; subjectType?: string; subjectId?: string; limit?: number } = {},
): Promise<NoteRow[]> {
  const { rows } = await tx.query<NoteRow>(
    `${SELECT}
      where ($1::uuid is null or n.customer_id = $1)
        and ($2::text is null or n.subject_type = $2)
        and ($3::uuid is null or n.subject_id = $3)
      order by n.pinned desc, n.created_at desc
      limit $4`,
    [opts.customerId ?? null, opts.subjectType ?? null, opts.subjectId ?? null, opts.limit ?? 50],
  );
  return rows;
}

export async function createNote(
  tx: Tx,
  input: {
    body: string;
    customerId?: string | null;
    subjectType?: string | null;
    subjectId?: string | null;
    pinned?: boolean;
  },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into notes (tenant_id, customer_id, subject_type, subject_id, body, author_id, pinned)
     values (current_tenant(), $1, $2, $3, $4, current_user_id(), coalesce($5, false))
     returning id`,
    [
      input.customerId ?? null, input.subjectType ?? null, input.subjectId ?? null,
      input.body.trim(), input.pinned ?? null,
    ],
  );
  return rows[0]!.id;
}

export async function updateNote(tx: Tx, id: string, body: string): Promise<boolean> {
  const { rowCount } = await tx.query(
    'update notes set body = $2, edited_at = now() where id = $1',
    [id, body.trim()],
  );
  return (rowCount ?? 0) > 0;
}

export async function togglePin(tx: Tx, id: string, pinned: boolean): Promise<boolean> {
  const { rowCount } = await tx.query('update notes set pinned = $2 where id = $1', [id, pinned]);
  return (rowCount ?? 0) > 0;
}

/** נכשל למי שאינו בעלים — המדיניות במסד עוצרת, לא הקוד כאן. */
export async function deleteNote(tx: Tx, id: string): Promise<boolean> {
  const { rowCount } = await tx.query('delete from notes where id = $1', [id]);
  return (rowCount ?? 0) > 0;
}
