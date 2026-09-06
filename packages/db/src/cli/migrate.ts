import { closePool } from '../client';
import { migrate } from '../migrate';

console.log('מריץ מיגרציות…');
const ran = await migrate();
console.log(ran.length === 0 ? '  אין מיגרציות חדשות.' : `\n${ran.length} מיגרציות הורצו.`);
await closePool();
