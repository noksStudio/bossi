import type { EventEnvelope, HandlerContext, ModuleId, PortDef } from './types';
import type { TenantComposition } from './registry';
import { DependencyError } from './graph';
import { usePort } from './registry';

export interface DispatchResult {
  readonly type: string;
  readonly handled: Array<{ moduleId: ModuleId; handlerId: string }>;
  readonly failed: Array<{ moduleId: ModuleId; handlerId: string; error: unknown }>;
}

/**
 * ניתוב אירוע למטפלים של ההרכבה.
 *
 * בייצור זה רץ דרך תור העבודות (pg-boss) — מטפל אחד לכל job, עם retry נפרד.
 * המימוש כאן סינכרוני ומשמש לפיתוח ולבדיקות, אבל הסמנטיקה זהה:
 * מטפל שנכשל לא מפיל את האחרים, והשגיאה מדווחת ולא נבלעת.
 */
export async function dispatch(
  composition: TenantComposition,
  event: EventEnvelope,
  deps: {
    tenantId: string;
    settingsFor: (moduleId: ModuleId) => unknown;
    emit: (e: Omit<EventEnvelope, 'tenantId' | 'occurredAt'>) => Promise<void>;
  },
): Promise<DispatchResult> {
  const handled: DispatchResult['handled'] = [];
  const failed: DispatchResult['failed'] = [];

  for (const { moduleId, handler } of composition.routes.get(event.type) ?? []) {
    const ctx: HandlerContext = {
      tenantId: deps.tenantId,
      port: <T,>(port: PortDef<T>): T => {
        const declared = composition.ports.get(port.id);
        if (!declared) {
          throw new DependencyError(`הפורט ${port.id} אינו זמין`, { port: port.id });
        }
        return usePort(composition, port);
      },
      emit: deps.emit,
      settings: <S,>() => deps.settingsFor(moduleId) as S,
    };

    try {
      await handler.handle(event, ctx);
      handled.push({ moduleId, handlerId: handler.id });
    } catch (error) {
      failed.push({ moduleId, handlerId: handler.id, error });
    }
  }

  return { type: event.type, handled, failed };
}
