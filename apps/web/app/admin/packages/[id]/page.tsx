import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  deleteFeaturePackage, duplicateFeaturePackage, getFeaturePackage, recordAudit, updateFeaturePackage,
} from '@bossi/db';
import { requireAdmin } from '@/lib/platform-session';
import { PackageForm } from '@/components/admin/package-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'עריכת חבילה · ניהול' };

export default async function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;

  const pkg = await getFeaturePackage(id);
  if (!pkg) notFound();

  async function update(formData: FormData) {
    'use server';
    const admin = await requireAdmin();
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return;

    await updateFeaturePackage(id, {
      name,
      description: String(formData.get('description') ?? '').trim() || null,
      moduleIds: formData.getAll('modules').map(String),
      isTemplate: formData.get('isTemplate') === 'on',
    });
    await recordAudit({ kind: 'package_updated', email: admin.email, detail: { packageId: id, name } });
    revalidatePath(`/admin/packages/${id}`);
  }

  async function duplicate() {
    'use server';
    const admin = await requireAdmin();
    const source = await getFeaturePackage(id);
    if (!source) return;

    const copyId = await duplicateFeaturePackage(id, `${source.name} — עותק`);
    if (!copyId) return;
    await recordAudit({ kind: 'package_duplicated', email: admin.email, detail: { sourceId: id, copyId } });
    redirect(`/admin/packages/${copyId}`);
  }

  async function remove() {
    'use server';
    const admin = await requireAdmin();
    await deleteFeaturePackage(id);
    await recordAudit({ kind: 'package_deleted', email: admin.email, detail: { packageId: id, name: pkg!.name } });
    redirect('/admin/packages');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-[1.6rem]">{pkg.name}</h1>
        <p className="mt-1 text-[0.88rem] text-muted">
          עריכה כאן משנה את התבנית עצמה — לא נוגעת בדיירים שכבר קיבלו אותה בעבר.
        </p>
      </div>

      <PackageForm
        action={update}
        defaultName={pkg.name}
        defaultDescription={pkg.description}
        defaultModuleIds={pkg.module_ids}
        defaultIsTemplate={pkg.is_template}
        submitLabel="שמור שינויים"
      />

      <div className="flex flex-wrap gap-3 border-t border-hairline pt-5">
        <form action={duplicate}>
          <button
            type="submit"
            className="rounded-md border border-strong px-4 py-2 text-[0.85rem] text-secondary transition-colors hover:bg-sunken"
          >
            שכפול — נקודת התחלה לחבילה הבאה
          </button>
        </form>
        <form action={remove}>
          <button
            type="submit"
            className="rounded-md border px-4 py-2 text-[0.85rem] transition-colors hover:bg-sunken"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          >
            מחיקה
          </button>
        </form>
      </div>

      <p className="text-[0.76rem] text-muted">
        כל שינוי כאן נרשם בתיעוד עם הכתובת <span dir="ltr">{admin.email}</span>.
      </p>
    </div>
  );
}
