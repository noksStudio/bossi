import { PLANS } from '@bossi/modules';
import { createTenant, withTenant } from './client';
import { createContact, createCustomer, createUser } from './repositories';
import { publishEvent } from './events';

/**
 * שני דיירים — אחד שירותים ואחד B2B — כדי שכל בדיקה ידנית תראה מיד
 * שההרכבה שונה, ושהבידוד ביניהם מחזיק.
 *
 * ה-seed רץ דרך `withTenant`, בדיוק כמו האפליקציה. לא דרך נתיב מיוחס.
 * אם הבידוד היה שבור, ה-seed היה נכשל — וזה בדיוק מה שרוצים ממנו.
 */
export async function seed(log: (msg: string) => void = console.log): Promise<{
  services: string;
  commerce: string;
}> {
  const services = await createTenant({
    slug: 'lavi-law',
    name: 'לביא ושות׳ — משרד עורכי דין',
    plan: 'pro',
    modules: PLANS.pro.modules,
    businessId: '514872910',
  });
  log(`  ✓ דייר שירותים: ${services}`);

  await withTenant(services, async (tx) => {
    await createUser(tx, { email: 'noa@lavi-law.co.il', name: 'נעה לביא', role: 'owner' });
    await createUser(tx, { email: 'office@lavi-law.co.il', name: 'רות מזרחי', role: 'manager' });

    const acme = await createCustomer(tx, {
      displayName: 'דני כהן — סטודיו',
      legalName: 'ד. כהן עיצוב בע״מ',
      businessId: '515993027',
      paymentTermsDays: 30,
      tags: ['ריטיינר', 'מעוצב'],
    });
    await createContact(tx, {
      customerId: acme,
      name: 'דני כהן',
      email: 'dani@cohen-studio.co.il',
      phone: '052-5551234',
      roles: ['approves', 'pays'],
      isPrimary: true,
    });
    await publishEvent(tx, {
      type: 'kernel.customer_created',
      actorType: 'system',
      customerId: acme,
      payload: { source: 'seed' },
    });

    const nurit = await createCustomer(tx, {
      displayName: 'נורית ברק — ייעוץ',
      paymentTermsDays: 45,
      tags: ['ריטיינר'],
    });
    await createContact(tx, { customerId: nurit, name: 'נורית ברק', email: 'nurit@barak.co.il', isPrimary: true });
    await createCustomer(tx, { displayName: 'מעבדות תבל בע״מ', status: 'prospect' });
  });

  const commerce = await createTenant({
    slug: 'tavor-supply',
    name: 'תבור אספקה טכנית',
    plan: 'mega',
    modules: PLANS.mega.modules,
    businessId: '512440817',
  });
  log(`  ✓ דייר B2B: ${commerce}`);

  await withTenant(commerce, async (tx) => {
    await createUser(tx, { email: 'yossi@tavor.co.il', name: 'יוסי תבור', role: 'owner' });

    const garage = await createCustomer(tx, {
      displayName: 'מוסך הצפון',
      paymentTermsDays: 60,
      creditLimit: '80000.00',
      tags: ['לקוח קבוע'],
    });
    // ב-B2B מי שמזמין, מי שמאשר ומי שמשלם הם שלושה אנשים שונים.
    await createContact(tx, { customerId: garage, name: 'איציק לוי', roles: ['orders'], isPrimary: true });
    await createContact(tx, { customerId: garage, name: 'מירי שגב', roles: ['approves'] });
    await createContact(tx, { customerId: garage, name: 'הנהלת חשבונות', email: 'ap@hatzafon.co.il', roles: ['pays'] });
    await publishEvent(tx, {
      type: 'kernel.customer_created',
      actorType: 'system',
      customerId: garage,
      payload: { source: 'seed' },
    });

    await createCustomer(tx, { displayName: 'אלקטרו רם', paymentTermsDays: 30, creditLimit: '25000.00' });
  });

  return { services, commerce };
}
