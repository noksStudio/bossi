import {
  type EventDef,
  type EventHandler,
  type ModuleId,
  type ModuleManifest,
  type NavEntry,
  type PortDef,
  type SlotContribution,
  type SlotId,
} from './types';
import { DependencyError, expandRequirements, topoSort } from './graph';

const EVENT_TYPE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export interface ValidationIssue {
  readonly level: 'error' | 'warning';
  readonly moduleId: ModuleId;
  readonly message: string;
}

/**
 * מרשם המודולים. מחזיק את כל המודולים שקיימים בקוד, מאמת שהם מרכיבים
 * מערכת קוהרנטית, ויודע להרכיב תת-קבוצה שלהם עבור דייר מסוים.
 */
export class ModuleRegistry {
  private readonly modules = new Map<ModuleId, ModuleManifest<any>>();

  register(...manifests: ModuleManifest<any>[]): this {
    for (const m of manifests) {
      if (this.modules.has(m.id)) {
        throw new DependencyError(`מודול כפול: ${m.id}`, { moduleId: m.id });
      }
      this.modules.set(m.id, m);
    }
    return this;
  }

  has(id: ModuleId): boolean {
    return this.modules.has(id);
  }

  get(id: ModuleId): ModuleManifest<any> {
    const m = this.modules.get(id);
    if (!m) throw new DependencyError(`מודול לא מוכר: ${id}`, { moduleId: id });
    return m;
  }

  all(): ModuleManifest<any>[] {
    return [...this.modules.values()];
  }

  /**
   * אימות סטטי של כל המרשם. נועד לרוץ ב-CI, לא בזמן ריצה.
   * תופס את הטעויות שהופכות מערכת מודולרית לספגטי לפני שהן נכנסות ל-main.
   */
  validate(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const err = (moduleId: ModuleId, message: string) =>
      issues.push({ level: 'error', moduleId, message });
    const warn = (moduleId: ModuleId, message: string) =>
      issues.push({ level: 'warning', moduleId, message });

    const portOwner = new Map<string, ModuleId>();
    const allEmitted = new Set<string>();
    const tableOwner = new Map<string, ModuleId>();

    for (const m of this.modules.values()) {
      // תלויות מוכרות
      for (const dep of m.requires ?? []) {
        if (!this.modules.has(dep)) err(m.id, `תלוי במודול לא מוכר: ${dep}`);
      }
      for (const dep of m.enhances ?? []) {
        if (!this.modules.has(dep)) err(m.id, `enhances מודול לא מוכר: ${dep}`);
      }

      // ספק יחיד לכל פורט
      for (const p of m.provides ?? []) {
        const owner = portOwner.get(p.port.id);
        if (owner) {
          err(m.id, `הפורט ${p.port.id} כבר מסופק על ידי ${owner} — לפורט יש ספק אחד בלבד`);
        } else {
          portOwner.set(p.port.id, m.id);
        }
      }

      // מרחב שמות של אירועים
      for (const e of m.emits ?? []) {
        if (!EVENT_TYPE_RE.test(e.type)) {
          err(m.id, `סוג אירוע לא תקין: ${e.type} (נדרש <namespace>.<name>)`);
        } else if (!e.type.startsWith(`${m.id}.`)) {
          err(m.id, `אסור לפלוט אירוע במרחב שם של מודול אחר: ${e.type}`);
        }
        if (allEmitted.has(e.type)) err(m.id, `סוג אירוע כפול: ${e.type}`);
        allEmitted.add(e.type);
      }

      // בעלות בלעדית על טבלאות
      for (const t of m.tables ?? []) {
        const owner = tableOwner.get(t);
        if (owner) err(m.id, `הטבלה ${t} כבר בבעלות ${owner}`);
        else tableOwner.set(t, m.id);
      }
    }

    // צריכת פורטים — חייבת להיות מכוסה על ידי תלות קשיחה
    for (const m of this.modules.values()) {
      const reachable = this.closureOf(m.id);
      for (const port of m.consumes ?? []) {
        const owner = portOwner.get(port.id);
        if (!owner) {
          err(m.id, `צורך פורט שאף מודול לא מספק: ${port.id}`);
        } else if (owner !== m.id && !reachable.has(owner)) {
          err(
            m.id,
            `צורך את ${port.id} מ-${owner}, אבל ${owner} אינו תלות קשיחה — הוסף אותו ל-requires`,
          );
        }
      }

      for (const h of m.handlers ?? []) {
        for (const type of h.on) {
          if (!allEmitted.has(type) && !type.startsWith('kernel.')) {
            warn(m.id, `המטפל ${h.id} מאזין לאירוע שאיש לא פולט: ${type}`);
          }
        }
        for (const dep of h.requires ?? []) {
          if (!this.modules.has(dep)) err(m.id, `המטפל ${h.id} דורש מודול לא מוכר: ${dep}`);
        }
      }

      for (const s of m.slots ?? []) {
        for (const dep of s.requires ?? []) {
          if (!this.modules.has(dep)) err(m.id, `התרומה ${s.id} דורשת מודול לא מוכר: ${dep}`);
        }
      }
    }

    // מעגלים
    try {
      topoSort([...this.modules.keys()], (id) => this.modules.get(id)?.requires ?? []);
    } catch (e) {
      if (e instanceof DependencyError) {
        err((e.details['cycle'] as ModuleId[] | undefined)?.[0] ?? '?', e.message);
      } else throw e;
    }

    return issues;
  }

  /** סגור התלויות הקשיחות של מודול (לא כולל עצמו). */
  private closureOf(id: ModuleId): Set<ModuleId> {
    const seen = new Set<ModuleId>();
    const queue = [...(this.modules.get(id)?.requires ?? [])];
    while (queue.length > 0) {
      const next = queue.shift() as ModuleId;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(...(this.modules.get(next)?.requires ?? []));
    }
    return seen;
  }

  /**
   * מרכיב את המערכת עבור דייר מסוים מתוך רשימת המודולים שהוא רכש.
   * תלויות חסרות מתווספות אוטומטית ומדווחות.
   */
  resolveTenant(requested: ModuleId[]): TenantComposition {
    const { resolved, added, missing } = expandRequirements(
      requested,
      (id) => this.modules.get(id)?.requires ?? [],
      (id) => this.modules.has(id),
    );
    if (missing.length > 0) {
      throw new DependencyError(`מודולים לא מוכרים: ${missing.join(', ')}`, { missing });
    }

    const order = topoSort(resolved, (id) => this.modules.get(id)!.requires ?? []);
    const enabled = new Set(order);
    const active = (requires?: ModuleId[]) => (requires ?? []).every((r) => enabled.has(r));

    const ports = new Map<string, { moduleId: ModuleId; factory: () => unknown }>();
    const nav: NavEntry[] = [];
    const slots = new Map<SlotId, SlotContribution[]>();
    const routes = new Map<string, Array<{ moduleId: ModuleId; handler: EventHandler }>>();
    const permissions = new Set<string>();
    const eventCatalog: EventDef<any>[] = [];
    const tables: string[] = [];

    for (const id of order) {
      const m = this.get(id);

      for (const p of m.provides ?? []) {
        ports.set(p.port.id, { moduleId: id, factory: p.factory });
      }
      for (const port of m.consumes ?? []) {
        if (!ports.has(port.id)) {
          throw new DependencyError(
            `${id} צורך את הפורט ${port.id} אך אף מודול פעיל אינו מספק אותו`,
            { moduleId: id, port: port.id },
          );
        }
      }

      nav.push(...(m.nav ?? []));
      for (const p of m.permissions ?? []) permissions.add(p);
      eventCatalog.push(...(m.emits ?? []));
      tables.push(...(m.tables ?? []));

      for (const s of m.slots ?? []) {
        if (!active(s.requires)) continue;
        const list = slots.get(s.slot) ?? [];
        list.push(s);
        slots.set(s.slot, list);
      }

      for (const h of m.handlers ?? []) {
        if (!active(h.requires)) continue;
        for (const type of h.on) {
          const list = routes.get(type) ?? [];
          list.push({ moduleId: id, handler: h });
          routes.set(type, list);
        }
      }
    }

    for (const [slot, list] of slots) {
      slots.set(slot, [...list].sort((a, b) => (a.order ?? 100) - (b.order ?? 100)));
    }
    nav.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

    return {
      requested: [...requested],
      enabled: order,
      autoAdded: added,
      ports,
      nav,
      slots,
      routes,
      permissions: [...permissions].sort(),
      eventCatalog,
      tables,
    };
  }
}

export interface TenantComposition {
  readonly requested: ModuleId[];
  /** בסדר טופולוגי — תלות תמיד לפני התלוי בה. */
  readonly enabled: ModuleId[];
  readonly autoAdded: ModuleId[];
  readonly ports: Map<string, { moduleId: ModuleId; factory: () => unknown }>;
  readonly nav: NavEntry[];
  readonly slots: Map<SlotId, SlotContribution[]>;
  readonly routes: Map<string, Array<{ moduleId: ModuleId; handler: EventHandler }>>;
  readonly permissions: string[];
  readonly eventCatalog: EventDef<any>[];
  readonly tables: string[];
}

/** גישה מטופסת לפורט מתוך הרכבה. */
export function usePort<T>(composition: TenantComposition, port: PortDef<T>): T {
  const entry = composition.ports.get(port.id);
  if (!entry) {
    throw new DependencyError(`הפורט ${port.id} אינו זמין להרכבה הזו`, { port: port.id });
  }
  return entry.factory() as T;
}

export function slotContributions(
  composition: TenantComposition,
  slot: SlotId,
): SlotContribution[] {
  return composition.slots.get(slot) ?? [];
}
