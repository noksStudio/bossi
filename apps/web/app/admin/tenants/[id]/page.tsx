import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getTenantSummary, recordAudit, setTenantModule, setTenantPlan, tenantModules } from '@bossi/db';
import { ALL_MODULES, PLANS, PLAN_ORDER, type PlanId } from '@bossi/modules';
import { requireAdmin } from '@/lib/platform-session';
import { StatTile, StatusPill } from '@/components/site/chrome';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'דייר · ניהול' };

/**
 * כרטיס הדייר — **ההרכבה שלו, לא הדאטה שלו**.
 *
 * שתי הפעולות היחידות כאן הן שינוי חבילה והדלקת מודול. שתיהן משנות מה
 * הלקוח מקבל ולא מה יש לו, ושתיהן נכתבות לתיעוד עם הכתובת של מי שביצע.
 *
 * מודול שאינו בחבילה מוצג ומסומן, ולא מוסתר: השאלה "למה הוא לא רואה
 * ריטיינרים" צריכה לקבל תשובה במסך ולא בקוד.
 */
export default async function AdminTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;

  const tenant = await getTenantSummary(id);
  if (!tenant) notFound();

  const enabled = await tenantModules(id);
  const enabledIds = new Set(enabled.filter((m) => m.enabled).map((m) => m.module_id));
  const plan = PLANS[tenant.plan as PlanId] ?? PLANS.starter;

  async function toggleModule(moduleId: string, next: boolean) {
    'use server';
    const admin = await requireAdmin();
    await setTenantModule(id, moduleId, next);
    await recordAudit({
      kind: next ? 'module_enabled' : 'module_disabled',
      email: admin.email,
      tenantId: id,
      detail: { module: moduleId },
    });
    revalidatePath(`/admin/tenants/${id}`);
  }

  async function changePlan(formData: FormData) {
    'use server';
    const admin = await requireAdmin();
    const next = String(formData.get('plan')) as PlanId;
    if (!PLAN_ORDER.includes(next)) return;

    await setTenantPlan(id, next);
    await recordAudit({ kind: 'plan_changed', email: admin.email, tenantId: id, detail: { plan: next } });
    revalidatePath(`/admin/tenants/${id}`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <nav className="mb-2 text-[0.78rem] text-muted">
          <Link href="/admin" className="hover:underline">דיירים</Link>
        </nav>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[1.6rem]">{tenant.name}</h1>
          {tenant.is_demo ? <StatusPill tone="neutral">הדגמה</StatusPill> : null}
        </div>
        <p className="mt-1 text-[0.88rem] text-muted">
          <span dir="ltr">{tenant.slug}</span>
          {tenant.business_id ? ` · ח.פ. ${tenant.business_id}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-hairline rounded-lg border border-hairline lg:grid-cols-4">
        <StatTile label="משתמשי צוות" value={String(tenant.users)} />
        <StatTile label="לקוחות פעילים" value={String(tenant.customers)} />
        <StatTile label="מסמכים" value={tenant.documents.toLocaleString('he-IL')} />
        <StatTile label="מודולים דלוקים" value={String(enabledIds.size)} note={`מתוך ${plan.modules.length} בחבילה`} />
      </div>

      <section className="rounded-lg border border-hairline">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">חבילה</h2>
          <p className="mt-0.5 text-[0.76rem] text-muted">
            שינוי חבילה משנה מכסות ואת רשימת המודולים הזמינים — הוא אינו מדליק מודולים בעצמו.
          </p>
        </header>
        <form action={changePlan} className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <label htmlFor="plan" className="block text-[0.8rem] text-secondary">חבילה</label>
            <select
              id="plan"
              name="plan"
              defaultValue={plan.id}
              className="mt-1 rounded-md border border-hairline bg-transparent px-3 py-1.5 text-[0.88rem]"
            >
              {PLAN_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PLANS[p].name} — {PLANS[p].monthlyPrice.toLocaleString('he-IL')} ₪
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md px-3 py-1.5 text-[0.85rem] font-medium transition-opacity hover:opacity-90"
            style={{ background: 'var(--text-primary)', color: 'var(--surface)' }}
          >
            עדכן חבילה
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-hairline">
        <header className="border-b border-hairline px-4 py-3">
          <h2 className="text-[0.98rem]">מודולים</h2>
          <p className="mt-0.5 text-[0.76rem] text-muted">
            מה שדלוק כאן הוא מה שהלקוח רואה בתפריט. מודול מחוץ לחבילה מסומן.
          </p>
        </header>
        <ul className="divide-y divide-hairline">
          {ALL_MODULES.map((module) => {
            const on = enabledIds.has(module.id);
            const inPlan = plan.modules.includes(module.id);
            return (
              <li key={module.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.9rem]">{module.name}</span>
                    {on ? <StatusPill tone="positive">דלוק</StatusPill> : null}
                    {!inPlan ? <StatusPill tone="warning">מחוץ לחבילה</StatusPill> : null}
                  </div>
                  <p className="mt-0.5 text-[0.76rem] text-muted">{module.description}</p>
                </div>
                <form action={toggleModule.bind(null, module.id, !on)}>
                  <button
                    type="submit"
                    className="rounded-sm border border-strong px-3 py-1 text-[0.78rem] text-secondary transition-colors hover:bg-sunken"
                  >
                    {on ? 'כבה' : 'הדלק'}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-[0.76rem] text-muted">
        כל שינוי כאן נרשם בתיעוד עם הכתובת <span dir="ltr">{admin.email}</span> ועם מועד הפעולה.
      </p>
    </div>
  );
}
