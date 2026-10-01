import { describe, expect, it } from 'vitest';
import { LEAD_BATCHES, batchLeads } from '../lib/lead-batches';
import { normalizePhone } from '../lib/phone';

describe('lead batches', () => {
  it('every line of every batch parses — nothing is silently dropped', () => {
    for (const batch of LEAD_BATCHES) {
      const lines = batch.raw.split('\n').filter((l) => l.trim());
      expect(batchLeads(batch), batch.id).toHaveLength(lines.length);
    }
  });

  it('no phone appears twice across all batches', () => {
    const phones = LEAD_BATCHES.flatMap((b) => batchLeads(b).map((l) => normalizePhone(l.phone)));
    expect(phones.filter((p, i) => phones.indexOf(p) !== i)).toEqual([]);
  });

  it('batch ids are unique', () => {
    const ids = LEAD_BATCHES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
