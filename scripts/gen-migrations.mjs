/**
 * מטמיע את קובצי המיגרציה כמודול TypeScript.
 *
 * הסיבה: בזמן ריצה על Vercel הקוד ארוז ב-.next, והנתיב היחסי לתיקיית
 * `migrations/` לא קיים שם. קריאה מהדיסק עובדת ב-CLI ונשברת בענן —
 * וזה בדיוק סוג התקלה שמתגלה רק בפרודקשן.
 *
 * קובצי ה-SQL נשארים מקור האמת לבני אדם; הקובץ הנוצר הוא מה שהקוד קורא.
 * `pnpm check` מוודא ששניהם מסונכרנים.
 *
 *   node scripts/gen-migrations.mjs [--check]
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'packages/db/migrations');
const out = join(root, 'packages/db/src/migrations.generated.ts');

const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
const entries = [];
for (const name of files) {
  entries.push({ name, sql: await readFile(join(dir, name), 'utf8') });
}

const body = `// נוצר אוטומטית על ידי scripts/gen-migrations.mjs — אין לערוך ידנית.
// מקור האמת הוא packages/db/migrations/*.sql
export interface Migration {
  readonly name: string;
  readonly sql: string;
}

export const MIGRATIONS: Migration[] = ${JSON.stringify(entries, null, 2)};
`;

if (process.argv.includes('--check')) {
  const current = await readFile(out, 'utf8').catch(() => '');
  if (current !== body) {
    console.error('✖ migrations.generated.ts אינו מסונכרן. הריצו: pnpm gen:migrations');
    process.exit(1);
  }
  console.log(`✓ ${files.length} מיגרציות מסונכרנות`);
} else {
  await writeFile(out, body);
  console.log(`✓ ${files.length} מיגרציות הוטמעו`);
}
