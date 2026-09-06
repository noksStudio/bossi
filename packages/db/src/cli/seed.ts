import { closePool } from '../client';
import { migrate } from '../migrate';
import { seed } from '../seed';

console.log('מריץ מיגרציות…');
await migrate();
console.log('זורע נתונים…');
await seed();
console.log('\nמוכן.');
await closePool();
