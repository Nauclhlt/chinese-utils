import { describe, expect, it } from 'vitest';
import { isDueForReview, sortByReviewPriority, updateSrsRecord } from '../../src/utils/srs';

describe('spaced repetition (SRS) and mastery', () => {
  it('increases mastery and interval on good/easy ratings', () => {
    const t0 = new Date('2026-11-24T00:00:00Z');
    const r1 = updateSrsRecord(undefined, 'V01-001', 'vocab', 'good', t0);
    expect(r1.mastery).toBe(20);
    expect(r1.intervalDays).toBe(1);
    expect(r1.repetitions).toBe(1);

    const r2 = updateSrsRecord(r1, 'V01-001', 'vocab', 'easy', t0);
    expect(r2.mastery).toBe(50);
    expect(r2.intervalDays).toBeGreaterThanOrEqual(3);
    expect(isDueForReview(r2, t0)).toBe(false);
  });

  it('resets interval and decreases mastery on again rating', () => {
    const t0 = new Date('2026-11-24T00:00:00Z');
    const r1 = updateSrsRecord(undefined, 'V01-001', 'vocab', 'easy', t0);
    const r2 = updateSrsRecord(r1, 'V01-001', 'vocab', 'again', t0);
    expect(r2.repetitions).toBe(0);
    expect(r2.intervalDays).toBe(0);
    expect(r2.wrongCount).toBe(1);
    expect(isDueForReview(r2, t0)).toBe(true);
  });

  it('prioritizes due weak items before unseen and future items', () => {
    const now = new Date('2026-11-24T12:00:00Z');
    const weakDue = updateSrsRecord(undefined, 'A', 'vocab', 'again', new Date('2026-11-24T00:00:00Z'));
    const futureItem = updateSrsRecord(undefined, 'B', 'vocab', 'easy', new Date('2026-11-24T11:00:00Z'));
    const sorted = sortByReviewPriority(
      [{ id: 'B' }, { id: 'C' }, { id: 'A' }],
      { A: weakDue, B: futureItem },
      now
    );
    expect(sorted.map((x) => x.id)).toEqual(['A', 'C', 'B']);
  });
});
