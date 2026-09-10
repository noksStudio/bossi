import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asPrincipal, getCustomerDetail, listDocuments } from '@bossi/db';
import { requirePrincipal } from '@/lib/session';
import { loadShell } from '@/lib/navigation';
import { customerTabs } from '@/lib/customer-tabs';
import { CustomerTabs } from '@/components/app/customer-tabs';
import { DocumentRowItem } from '@/components/app/document-row';
import { DocumentSelectionProvider } from '@/components/app/document-selection';
import { DocumentUpload } from '@/components/app/document-upload';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;
  const customer = await asPrincipal(principal, (tx) => getCustomerDetail(tx, id));
  return { title: `מסמכים · ${customer?.display_name ?? 'לקוח'}` };
}

export default async function CustomerDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePrincipal();
  const { id } = await params;

  const [customer, shell, documents] = await Promise.all([
    asPrincipal(principal, (tx) => getCustomerDetail(tx, id)),
    loadShell(principal),
    asPrincipal(principal, (tx) => listDocuments(tx, { customerId: id, limit: 200 })),
  ]);
  if (!customer) notFound();

  return (
    <DocumentSelectionProvider>
      <div className="space-y-6">
        <nav className="text-[0.8rem] text-muted">
          <Link href="/customers" className="hover:text-primary">לקוחות</Link>
          <span className="mx-1.5" aria-hidden="true">/</span>
          <Link href={`/customers/${id}`} className="hover:text-primary">{customer.display_name}</Link>
          <span className="mx-1.5" aria-hidden="true">/</span>
          <span>מסמכים</span>
        </nav>

        <h1 className="text-[1.5rem]">{customer.display_name} · מסמכים</h1>

        <CustomerTabs tabs={customerTabs(shell.slots('customer.tabs'), id)} customerId={id} active="documents.tab" />

        <DocumentUpload customerId={id} />

        {documents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-strong p-10 text-center">
            <h2 className="text-[1.02rem]">אין מסמכים ללקוח הזה</h2>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-hairline">
            <div className="border-b border-hairline bg-sunken px-4 py-2 text-[0.76rem] text-muted">
              {documents.length === 1 ? 'מסמך אחד' : `${documents.length} מסמכים`}
            </div>
            <ul className="divide-y divide-hairline">
              {documents.map((d) => (
                <DocumentRowItem key={d.id} doc={d} showCustomer={false} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </DocumentSelectionProvider>
  );
}
