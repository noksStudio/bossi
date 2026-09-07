import { closePool } from '../client';
import { migrate } from '../migrate';
import { resetDemo, seedDemo } from '../demo/seed';
import { seedRealEstate } from '../demo/realestate';

const reset = process.argv.includes('--reset');

await migrate(() => {});
if (reset) {
  console.log('מאפס דמו…');
  await resetDemo();
}
const result = await seedDemo();
await seedRealEstate();
console.log(
  `\nמוכן. ${result.services.documents + result.commerce.documents} מסמכים, ` +
    `${result.services.events + result.commerce.events} אירועים.`,
);
await closePool();
