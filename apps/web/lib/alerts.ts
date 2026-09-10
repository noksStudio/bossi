import { buildAlerts, type Alert, type AlertInputs } from '@bossi/core';
import {
  asPrincipal, expiringDocuments, listDocuments, listLeases, overdueChecks,
  quietCustomers, type Principal,
} from '@bossi/db';
import type { TenantShell } from './navigation';

/**
 * אוסף את הקלט למנוע ההתראות מהמודולים הפעילים בלבד.
 *
 * מודול כבוי לא נשאל, ולכן אין כאן שום `if` שיודע מי דלוק — רק בדיקת
 * חברות ברשימה. הלוגיקה עצמה טהורה ויושבת ב-core.
 */
export async function loadAlerts(principal: Principal, shell: TenantShell): Promise<Alert[]> {
  const has = (m: string) => shell.modules.includes(m);

  const [documents, checks, leases, quiet] = await Promise.all([
    has('documents')
      ? asPrincipal(principal, async (tx) => [
          ...(await expiringDocuments(tx, 60)),
          ...(await listDocuments(tx, { status: 'needs_review', limit: 10 })),
        ])
      : Promise.resolve([]),
    has('checks') ? asPrincipal(principal, (tx) => overdueChecks(tx)) : Promise.resolve([]),
    has('leases') ? asPrincipal(principal, (tx) => listLeases(tx, { status: 'active' })) : Promise.resolve([]),
    asPrincipal(principal, (tx) => quietCustomers(tx, 60, 5)),
  ]);

  const inputs: AlertInputs = {
    documents: documents.map((d) => ({
      id: d.id, title: d.title, expires_on: d.expires_on,
      status: d.status, customer_id: d.customer_id, customer_name: d.customer_name,
    })),
    checks: checks.map((c) => ({
      id: c.id, customer_id: c.customer_id, customer_name: c.customer_name,
      check_number: c.check_number, amount: c.amount, due_on: c.due_on,
      status: c.status, cleared_amount: c.cleared_amount,
    })),
    leases: leases.map((l) => ({
      id: l.id, customer_id: l.customer_id, customer_name: l.customer_name,
      property_name: l.property_name, ends_on: l.ends_on,
      notice_days: l.notice_days, status: l.status,
    })),
    quietCustomers: quiet.map((c) => ({
      id: c.id, display_name: c.display_name, days_quiet: c.days_quiet,
    })),
  };

  return buildAlerts(inputs);
}
