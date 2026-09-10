import { redirect } from 'next/navigation';
import { createFeaturePackage, recordAudit } from '@bossi/db';
import { requireAdmin } from '@/lib/platform-session';
import { PackageForm } from '@/components/admin/package-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'חבילה חדשה · ניהול' };

export default async function NewPackagePage() {
  await requireAdmin();

  async function create(formData: FormData) {
    'use server';
    const admin = await requireAdmin();
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return;

    const id = await createFeaturePackage({
      name,
      description: String(formData.get('description') ?? '').trim() || null,
      moduleIds: formData.getAll('modules').map(String),
      isTemplate: formData.get('isTemplate') === 'on',
    });
    await recordAudit({ kind: 'package_created', email: admin.email, detail: { packageId: id, name } });
    redirect(`/admin/packages/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-[1.6rem]">חבילה חדשה</h1>
        <p className="mt-1 text-[0.88rem] text-muted">בוחרים מודולים ונותנים שם — אפשר לשנות הכול אחר כך.</p>
      </div>
      <PackageForm action={create} submitLabel="צור חבילה" />
    </div>
  );
}
