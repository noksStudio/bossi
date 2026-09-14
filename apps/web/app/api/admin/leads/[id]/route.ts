import { NextResponse, type NextRequest } from 'next/server';
import {
  deleteProspect, getProspect, listProspectNotes, setProspectBooked, setProspectContacted,
  setProspectFollowUp, updateProspectField, type EditableProspectField,
} from '@bossi/db';
import { currentAdmin } from '@/lib/platform-session';

export const dynamic = 'force-dynamic';

const TEXT_FIELDS = new Set<EditableProspectField>(['phone', 'address', 'website', 'note', 'national_id', 'company_number']);

/**
 * ה-API שמחליף את ה-server actions בפופ-אפ הליד: שמירה אטומית לכל
 * שדה בפני עצמו, בלי redirect שסוגר את הפופ-אפ. `requireAdmin` לא
 * מתאים כאן — הוא מפנה (`redirect`) לעמוד ההתחברות, וזו תגובת HTML
 * לא JSON; `currentAdmin` מחזיר `null` ואנחנו קובעים בעצמנו 401.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const prospect = await getProspect(id);
  if (!prospect) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const notes = await listProspectNotes(id);
  return NextResponse.json({ prospect, notes });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const field = body?.field;

  if (field === 'contacted') {
    const ok = await setProspectContacted(id, Boolean(body.value));
    if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  } else if (field === 'booked') {
    const ok = await setProspectBooked(id, Boolean(body.value));
    if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  } else if (field === 'followUp') {
    const value = typeof body.value === 'string' && body.value ? body.value : null;
    const ok = await setProspectFollowUp(id, value);
    if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  } else if (TEXT_FIELDS.has(field)) {
    const value = typeof body.value === 'string' ? body.value.trim() || null : null;
    const ok = await updateProspectField(id, field, value);
    if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  } else {
    return NextResponse.json({ error: 'unknown_field' }, { status: 400 });
  }

  const prospect = await getProspect(id);
  return NextResponse.json({ prospect });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const ok = await deleteProspect(id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
