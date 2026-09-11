import type { Tx } from './client';

/**
 * תבניות הודעה — טקסט שמור לפנייה, לא כלי שליחה. `{{contact_name}}`
 * ו-`{{business_name}}` הם ה-placeholders שהעמוד הקורא ממלא לפני
 * העתקה (ראו fillTemplate); השכבה הזו לא יודעת עליהם כלום, רק
 * מאחסנת ומחזירה טקסט.
 */

export const TEMPLATE_CHANNELS = {
  whatsapp: 'WhatsApp',
  email: 'אימייל',
  linkedin: 'LinkedIn',
  phone: 'תסריט טלפון',
  other: 'אחר',
} as const;

export type TemplateChannel = keyof typeof TEMPLATE_CHANNELS;

export interface MessageTemplateRow {
  id: string;
  name: string;
  channel: TemplateChannel;
  body: string;
  created_at: Date;
  updated_at: Date | null;
}

const SELECT = `select id, name, channel, body, created_at, updated_at from message_templates`;

export async function listTemplates(tx: Tx, channel?: string): Promise<MessageTemplateRow[]> {
  const { rows } = await tx.query<MessageTemplateRow>(
    `${SELECT} where ($1::text is null or channel = $1) order by created_at desc`,
    [channel ?? null],
  );
  return rows;
}

export async function getTemplate(tx: Tx, id: string): Promise<MessageTemplateRow | null> {
  const { rows } = await tx.query<MessageTemplateRow>(`${SELECT} where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createTemplate(
  tx: Tx,
  input: { name: string; channel: TemplateChannel; body: string },
): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `insert into message_templates (tenant_id, name, channel, body)
     values (current_tenant(), $1, $2, $3)
     returning id`,
    [input.name.trim(), input.channel, input.body.trim()],
  );
  return rows[0]!.id;
}

export async function updateTemplate(
  tx: Tx,
  id: string,
  input: { name: string; channel: TemplateChannel; body: string },
): Promise<boolean> {
  const { rowCount } = await tx.query(
    `update message_templates set name = $2, channel = $3, body = $4, updated_at = now() where id = $1`,
    [id, input.name.trim(), input.channel, input.body.trim()],
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteTemplate(tx: Tx, id: string): Promise<boolean> {
  const { rowCount } = await tx.query('delete from message_templates where id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

/**
 * ממלאת placeholders בטקסט התבנית. `{{contact_name}}`/`{{business_name}}`
 * שאין להם ערך (ליד בלי איש קשר, למשל) מוחלפים במחרוזת ריקה, לא
 * נשארים כמו שהם בטקסט — הודעה עם "{{contact_name}}" באמצע נראית
 * כמו טעות, לא כמו שדה ריק.
 */
export function fillTemplate(body: string, values: { contactName?: string | null; businessName?: string | null }): string {
  return body
    .replaceAll('{{contact_name}}', values.contactName ?? '')
    .replaceAll('{{business_name}}', values.businessName ?? '');
}
