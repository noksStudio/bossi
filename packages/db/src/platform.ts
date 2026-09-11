import { withPlatform } from './client';

/**
 * שאילתות ברמת הפלטפורמה — היחידות במערכת שחוצות דיירים.
 *
 * **מטא-דאטה בלבד.** מספרים על דייר, לא תוכן שלו: כמה לקוחות, כמה
 * מסמכים, כמה אחסון, איזו חבילה. אין כאן שאילתה שמחזירה שם של לקוח,
 * כותרת של מסמך או סכום של חשבונית — וזו ההפרדה שמאפשרת לומר ללקוח
 * שאף אחד ב-Bossi לא רואה את התיקים שלו.
 *
 * הכול רץ תחת `withPlatform`, וזה תלוי בכך שתפקיד החיבור אינו כפוף
 * ל-RLS. `platformReach()` בודק את ההנחה הזו במפורש במקום להניח אותה,
 * כי הכישלון השקט שלה הוא מסך שמראה אפסים ונראה תקין.
 */

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  business_id: string | null;
  plan: string;
  is_demo: boolean;
  created_at: Date;
  modules: number;
  users: number;
  customers: number;
  documents: number;
  storage_bytes: string;
  last_activity_at: Date | null;
  /** כניסות ופעולות-אנוש ב-14 הימים האחרונים — הקלט למעורבות (packages/core). */
  logins_14d: number;
  actions_14d: number;
}

const ENGAGEMENT_WINDOW = "interval '14 days'";

export async function listTenants(): Promise<TenantSummary[]> {
  const { rows } = await withPlatform((tx) =>
    tx.query<
      TenantSummary & { modules: string; users: string; customers: string; documents: string; logins_14d: string; actions_14d: string }
    >(`
      select t.id, t.slug, t.name, t.business_id,
             coalesce(s.plan, 'starter')                                         as plan,
             t.is_demo, t.created_at,
             (select count(*) from tenant_modules m
               where m.tenant_id = t.id and m.enabled)::text                     as modules,
             (select count(*) from users u
               where u.tenant_id = t.id and u.status = 'active')::text            as users,
             (select count(*) from customers c
               where c.tenant_id = t.id and c.status = 'active')::text            as customers,
             (select count(*) from documents d where d.tenant_id = t.id)::text    as documents,
             coalesce((select sum(d.byte_size) from documents d
               where d.tenant_id = t.id), 0)::text                               as storage_bytes,
             (select max(e.occurred_at) from events e where e.tenant_id = t.id)   as last_activity_at,
             (select count(*) from events e
               where e.tenant_id = t.id and e.type = 'kernel.user_signed_in'
                 and e.occurred_at >= now() - ${ENGAGEMENT_WINDOW})::text         as logins_14d,
             (select count(*) from events e
               where e.tenant_id = t.id and e.actor_type = 'user'
                 and e.type <> 'kernel.user_signed_in'
                 and e.occurred_at >= now() - ${ENGAGEMENT_WINDOW})::text         as actions_14d
        from tenants t
        left join subscriptions s on s.tenant_id = t.id
       order by t.is_demo, t.created_at desc
    `),
  );
  return rows.map((r) => ({
    ...r,
    modules: Number(r.modules),
    users: Number(r.users),
    customers: Number(r.customers),
    documents: Number(r.documents),
    logins_14d: Number(r.logins_14d),
    actions_14d: Number(r.actions_14d),
  }));
}

export async function getTenantSummary(id: string): Promise<TenantSummary | null> {
  const all = await listTenants();
  return all.find((t) => t.id === id) ?? null;
}

/** המודולים של דייר, כולל אלה שכבויים — המסך צריך להציג את שניהם. */
export async function tenantModules(id: string): Promise<Array<{ module_id: string; enabled: boolean }>> {
  const { rows } = await withPlatform((tx) =>
    tx.query<{ module_id: string; enabled: boolean }>(
      'select module_id, enabled from tenant_modules where tenant_id = $1 order by module_id',
      [id],
    ),
  );
  return rows;
}

export async function setTenantModule(id: string, moduleId: string, enabled: boolean): Promise<void> {
  await withPlatform((tx) =>
    tx.query(
      `insert into tenant_modules (tenant_id, module_id, enabled)
       values ($1, $2, $3)
       on conflict (tenant_id, module_id) do update
         set enabled     = excluded.enabled,
             enabled_at  = case when excluded.enabled then now() else tenant_modules.enabled_at end,
             disabled_at = case when excluded.enabled then null else now() end`,
      [id, moduleId, enabled],
    ),
  );
}

export async function setTenantPlan(id: string, plan: 'starter' | 'pro' | 'mega'): Promise<void> {
  await withPlatform((tx) =>
    tx.query(
      `insert into subscriptions (tenant_id, plan) values ($1, $2)
       on conflict (tenant_id) do update set plan = excluded.plan`,
      [id, plan],
    ),
  );
}

/** מצב המסד — לכותרת מסך המערכת. */
export interface PlatformStatus {
  migrations: number;
  tenants: number;
  realTenants: number;
  documents: number;
  /** האם נתיב הפלטפורמה באמת רואה חוצה-דיירים. ראה `platformReach`. */
  reach: 'ok' | 'blocked' | 'no_schema';
}

export async function platformStatus(): Promise<PlatformStatus> {
  try {
    const { rows } = await withPlatform((tx) =>
      tx.query<Record<string, string>>(`
        select (select count(*) from _migrations)::text                        as migrations,
               (select count(*) from tenants)::text                            as tenants,
               (select count(*) from tenants where is_demo = false)::text      as real_tenants,
               (select count(*) from documents)::text                          as documents
      `),
    );
    const r = rows[0]!;
    return {
      migrations: Number(r['migrations']),
      tenants: Number(r['tenants']),
      realTenants: Number(r['real_tenants']),
      documents: Number(r['documents']),
      reach: await platformReach(Number(r['tenants'])),
    };
  } catch {
    return { migrations: 0, tenants: 0, realTenants: 0, documents: 0, reach: 'no_schema' };
  }
}

/**
 * מוודא שנתיב הפלטפורמה באמת עוקף בידוד.
 *
 * הבדיקה חשובה כי הכישלון שלה שקט: אם תפקיד החיבור כפוף ל-RLS,
 * `withPlatform` מחזיר אפס שורות בלי שגיאה — והקונסולה תציג "אין
 * דיירים" על מסד מלא. עדיף לומר "חסום" מאשר להראות אפס ולהיראות תקין.
 */
async function platformReach(tenantCount: number): Promise<'ok' | 'blocked'> {
  if (tenantCount === 0) return 'ok';           // מסד ריק — אין מה להסיק
  const { rows } = await withPlatform((tx) =>
    tx.query<{ n: string }>('select count(*)::text as n from users'),
  );
  // יש דיירים אבל אף משתמש אינו נראה → המדיניות חוסמת גם את הפלטפורמה.
  return Number(rows[0]?.n ?? 0) > 0 ? 'ok' : 'blocked';
}
