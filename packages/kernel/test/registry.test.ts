import { describe, expect, it } from 'vitest';
import { ModuleRegistry, definePort, defineEvent, type ModuleManifest } from '../src/index';

const Port = definePort<{ ping(): string }>('a.port');

const mod = (m: Partial<ModuleManifest> & { id: string }): ModuleManifest => ({
  name: m.id,
  description: '',
  category: 'money',
  ...m,
});

describe('ModuleRegistry.validate', () => {
  it('עובר על מרשם תקין', () => {
    const r = new ModuleRegistry().register(
      mod({ id: 'a', provides: [{ port: Port, factory: () => ({ ping: () => 'ok' }) }] }),
      mod({ id: 'b', requires: ['a'], consumes: [Port] }),
    );
    expect(r.validate()).toEqual([]);
  });

  it('פוסל תלות במודול לא מוכר', () => {
    const issues = new ModuleRegistry().register(mod({ id: 'a', requires: ['ghost'] })).validate();
    expect(issues.some((i) => i.level === 'error' && i.message.includes('ghost'))).toBe(true);
  });

  it('פוסל שני ספקים לאותו פורט', () => {
    const issues = new ModuleRegistry()
      .register(
        mod({ id: 'a', provides: [{ port: Port, factory: () => ({ ping: () => '1' }) }] }),
        mod({ id: 'b', provides: [{ port: Port, factory: () => ({ ping: () => '2' }) }] }),
      )
      .validate();
    expect(issues.some((i) => i.message.includes('ספק אחד בלבד'))).toBe(true);
  });

  it('פוסל צריכת פורט ללא תלות קשיחה — זה מה שמונע צימוד סמוי', () => {
    const issues = new ModuleRegistry()
      .register(
        mod({ id: 'a', provides: [{ port: Port, factory: () => ({ ping: () => 'ok' }) }] }),
        mod({ id: 'b', consumes: [Port] }), // אין requires: ['a']
      )
      .validate();
    expect(issues.some((i) => i.message.includes('requires'))).toBe(true);
  });

  it('פוסל פליטת אירוע במרחב שם של מודול אחר', () => {
    const issues = new ModuleRegistry()
      .register(mod({ id: 'a', emits: [defineEvent('billing.invoice_issued', '')] }))
      .validate();
    expect(issues.some((i) => i.message.includes('מרחב שם'))).toBe(true);
  });

  it('פוסל סוג אירוע ללא מרחב שם', () => {
    const issues = new ModuleRegistry()
      .register(mod({ id: 'a', emits: [defineEvent('bare', '')] }))
      .validate();
    expect(issues.some((i) => i.message.includes('לא תקין'))).toBe(true);
  });

  it('פוסל שתי בעלויות על אותה טבלה', () => {
    const issues = new ModuleRegistry()
      .register(mod({ id: 'a', tables: ['invoices'] }), mod({ id: 'b', tables: ['invoices'] }))
      .validate();
    expect(issues.some((i) => i.message.includes('בבעלות'))).toBe(true);
  });

  it('מתריע (ולא פוסל) על מטפל לאירוע שאיש לא פולט', () => {
    const issues = new ModuleRegistry()
      .register(mod({ id: 'a', handlers: [{ id: 'h', on: ['nobody.emits_this'], handle: () => {} }] }))
      .validate();
    expect(issues).toHaveLength(1);
    expect(issues[0]!.level).toBe('warning');
  });

  it('פוסל רישום כפול של מודול', () => {
    const r = new ModuleRegistry().register(mod({ id: 'a' }));
    expect(() => r.register(mod({ id: 'a' }))).toThrow(/כפול/);
  });
});
