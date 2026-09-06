import { ModuleRegistry } from '@bossi/kernel';
import { ALL_MODULES } from './manifests.js';

export * from './ports.js';
export * from './manifests.js';
export { stubPort } from './stub.js';

/** המרשם המלא של המערכת. דייר מקבל תת-קבוצה שלו. */
export function createRegistry(): ModuleRegistry {
  return new ModuleRegistry().register(...ALL_MODULES);
}
