import { withPlatform } from './client';
import { MIGRATIONS } from './migrations.generated';

/**
 * מריץ מיגרציות שטרם הורצו, לפי סדר שם הקובץ, כל אחת בטרנזקציה משלה.
 * קדימה בלבד — אין down. גלגול לאחור נעשה במיגרציה חדשה.
 */
export async function migrate(log: (msg: string) => void = console.log): Promise<string[]> {
  await withPlatform((tx) =>
    tx.query(`
      create table if not exists _migrations (
        name        text primary key,
        applied_at  timestamptz not null default now(),
        checksum    text not null
      )
    `),
  );

  const { rows } = await withPlatform((tx) =>
    tx.query<{ name: string; checksum: string }>('select name, checksum from _migrations'),
  );
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));

  const ran: string[] = [];
  for (const { name, sql } of MIGRATIONS) {
    const checksum = await sha256(sql);
    const previous = applied.get(name);

    if (previous !== undefined) {
      if (previous !== checksum) {
        throw new Error(
          `המיגרציה ${name} שונתה אחרי שהורצה. מיגרציות הן קדימה בלבד — צרו קובץ חדש.`,
        );
      }
      continue;
    }

    await withPlatform(async (tx) => {
      await tx.query(sql);
      await tx.query('insert into _migrations (name, checksum) values ($1, $2)', [name, checksum]);
    });
    log(`  ✓ ${name}`);
    ran.push(name);
  }

  return ran;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
