import { NextResponse, type NextRequest } from 'next/server';
import { addProspectNote, listProspectNotes } from '@bossi/db';
import { currentAdmin } from '@/lib/platform-session';

export const dynamic = 'force-dynamic';

/** הוספת רשומת שיחה מהפופ-אפ — בלי redirect, כדי שהתגובה תופיע מיד באותו מקום. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!text) return NextResponse.json({ error: 'empty' }, { status: 400 });

  await addProspectNote(id, text);
  const notes = await listProspectNotes(id);
  return NextResponse.json({ notes });
}
