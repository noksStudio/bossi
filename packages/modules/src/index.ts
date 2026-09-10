import { ModuleRegistry } from '@bossi/kernel';
import { ALL_MODULES } from './manifests';

export * from './ports';
export * from './manifests';
export * from './plans';
export * from './categories';
export { stubPort } from './stub';

/** המרשם המלא של המערכת. דייר מקבל תת-קבוצה שלו. */
export function createRegistry(): ModuleRegistry {
  return new ModuleRegistry().register(...ALL_MODULES);
}
