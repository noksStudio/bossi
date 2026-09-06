import { closePool, withPlatform } from '../client';
import { migrate } from '../migrate';
import { seed } from '../seed';

const url = process.env['DATABASE_URL'] ?? '';
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error('reset מסרב לרוץ מול מסד שאינו מקומי.');
  process.exit(1);
}

console.log('מוחק ובונה מחדש…');
await withPlatform((tx) => tx.query('drop schema public cascade; create schema public;'));
await migrate();
await seed();
console.log('\nמוכן.');
await closePool();
