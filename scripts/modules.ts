/**
 * דוח הרכבה: מה בדיוק מקבל דייר עם קבוצת המודולים הזו.
 *   pnpm modules services
 *   pnpm modules documents billing
 */
import { PRESETS, slotContributions, type SlotId } from '@bossi/kernel';
import { createRegistry } from '@bossi/modules';

const registry = createRegistry();

const issues = registry.validate();
const errors = issues.filter((i) => i.level === 'error');
if (errors.length > 0) {
  console.error('✖ המרשם אינו תקין:');
  for (const i of errors) console.error(`  [${i.moduleId}] ${i.message}`);
  process.exit(1);
}
for (const i of issues) console.warn(`⚠ [${i.moduleId}] ${i.message}`);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('חבילות זמינות:', Object.keys(PRESETS).join(', '));
  console.log('מודולים זמינים:', registry.all().map((m) => m.id).join(', '));
  process.exit(0);
}

const requested = args.flatMap((a) => (a in PRESETS ? PRESETS[a as keyof typeof PRESETS] : [a]));
const c = registry.resolveTenant([...requested]);

const line = (s = '') => console.log(s);
line(`\n═══ הרכבה: ${args.join(' + ')} ═══\n`);
line(`מודולים פעילים (${c.enabled.length}), בסדר אתחול:`);
for (const id of c.enabled) {
  const m = registry.get(id);
  const auto = c.autoAdded.includes(id) ? '  ← נוסף אוטומטית כתלות' : '';
  line(`  ${id.padEnd(14)} ${m.name}${auto}`);
}

line(`\nניווט — צוות:`);
for (const n of c.nav.filter((n) => (n.realm ?? 'staff') === 'staff')) line(`  ${n.href.padEnd(22)} ${n.label}`);
const portalNav = c.nav.filter((n) => n.realm === 'portal');
if (portalNav.length > 0) {
  line(`\nניווט — פורטל לקוחות:`);
  for (const n of portalNav) line(`  ${n.href.padEnd(22)} ${n.label}`);
}

line(`\nפורטים זמינים:`);
for (const [portId, { moduleId }] of c.ports) line(`  ${portId.padEnd(24)} ← ${moduleId}`);

const slotIds: SlotId[] = ['dashboard.widgets', 'customer.tabs', 'customer.overview.cards', 'customer.actions'];
line(`\nתרומות UI:`);
for (const slot of slotIds) {
  const list = slotContributions(c, slot);
  if (list.length === 0) continue;
  line(`  ${slot}`);
  for (const s of list) {
    const cond = s.requires?.length ? `  (מותנה: ${s.requires.join(', ')})` : '';
    line(`    · ${s.label ?? s.id}${cond}`);
  }
}

line(`\nניתוב אירועים (${c.routes.size} סוגים עם מאזינים):`);
for (const [type, handlers] of [...c.routes].sort()) {
  line(`  ${type.padEnd(30)} → ${handlers.map((h) => h.moduleId).join(', ')}`);
}

line(`\nטבלאות בבעלות המודולים (${c.tables.length}):`);
line(`  ${c.tables.join(', ')}`);
line(`\nהרשאות (${c.permissions.length}):`);
line(`  ${c.permissions.join(', ')}`);
line();
