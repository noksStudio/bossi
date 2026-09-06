import type { ModuleId } from './types.js';

export class DependencyError extends Error {
  constructor(message: string, readonly details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'DependencyError';
  }
}

/**
 * סדר טופולוגי: תלות תמיד לפני התלוי בה.
 * קובע את סדר האתחול, סדר המיגרציות וסדר רישום הפורטים.
 */
export function topoSort(
  ids: ModuleId[],
  depsOf: (id: ModuleId) => ModuleId[],
): ModuleId[] {
  const present = new Set(ids);
  const state = new Map<ModuleId, 'visiting' | 'done'>();
  const out: ModuleId[] = [];

  const visit = (id: ModuleId, path: ModuleId[]): void => {
    const s = state.get(id);
    if (s === 'done') return;
    if (s === 'visiting') {
      const cycle = [...path.slice(path.indexOf(id)), id];
      throw new DependencyError(`מעגל תלויות: ${cycle.join(' → ')}`, { cycle });
    }
    state.set(id, 'visiting');
    for (const dep of depsOf(id)) {
      if (present.has(dep)) visit(dep, [...path, id]);
    }
    state.set(id, 'done');
    out.push(id);
  };

  for (const id of ids) visit(id, []);
  return out;
}

/** סוגר את קבוצת המודולים תחת התלויות הקשיחות שלהן. */
export function expandRequirements(
  requested: ModuleId[],
  requiresOf: (id: ModuleId) => ModuleId[],
  known: (id: ModuleId) => boolean,
): { resolved: ModuleId[]; added: ModuleId[]; missing: ModuleId[] } {
  const resolved = new Set<ModuleId>();
  const added: ModuleId[] = [];
  const missing = new Set<ModuleId>();
  const queue = [...requested];

  while (queue.length > 0) {
    const id = queue.shift() as ModuleId;
    if (resolved.has(id)) continue;
    if (!known(id)) {
      missing.add(id);
      continue;
    }
    resolved.add(id);
    if (!requested.includes(id)) added.push(id);
    queue.push(...requiresOf(id));
  }

  return { resolved: [...resolved], added, missing: [...missing] };
}
