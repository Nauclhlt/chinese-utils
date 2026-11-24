import type { SrsRating, SrsRecord } from '../types/user';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function createInitialSrsRecord(
  id: string,
  kind: SrsRecord['kind'],
  now = new Date()
): SrsRecord {
  const iso = now.toISOString();
  return {
    id,
    kind,
    mastery: 0,
    intervalDays: 0,
    easeFactor: 2.5,
    repetitions: 0,
    lastReviewedAt: iso,
    nextReviewAt: iso,
    correctCount: 0,
    wrongCount: 0,
  };
}

/**
 * Update an SRS record using an SM-2 style interval calculation.
 */
export function updateSrsRecord(
  prev: SrsRecord | undefined,
  id: string,
  kind: SrsRecord['kind'],
  rating: SrsRating,
  now = new Date()
): SrsRecord {
  const base = prev ?? createInitialSrsRecord(id, kind, now);
  const qualityMap: Record<SrsRating, number> = {
    again: 1,
    hard: 3,
    good: 4,
    easy: 5,
  };
  const q = qualityMap[rating];

  let repetitions = base.repetitions;
  let intervalDays = base.intervalDays;
  let easeFactor = base.easeFactor;
  let mastery = base.mastery;
  let correctCount = base.correctCount;
  let wrongCount = base.wrongCount;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 0; // due immediately / today
    mastery = Math.max(0, mastery - 20);
    wrongCount += 1;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 3;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    if (rating === 'hard') {
      intervalDays = Math.max(1, Math.round(intervalDays * 0.7));
      mastery = Math.min(100, mastery + 10);
    } else if (rating === 'good') {
      mastery = Math.min(100, mastery + 20);
    } else {
      intervalDays = Math.max(2, Math.round(intervalDays * 1.3));
      mastery = Math.min(100, mastery + 30);
    }
    repetitions += 1;
    correctCount += 1;
  }

  easeFactor = Math.max(
    1.3,
    Number((easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))).toFixed(2))
  );

  const nextReviewAt = new Date(now.getTime() + intervalDays * MS_PER_DAY).toISOString();

  return {
    ...base,
    mastery,
    intervalDays,
    easeFactor,
    repetitions,
    lastReviewedAt: now.toISOString(),
    nextReviewAt,
    correctCount,
    wrongCount,
  };
}

export function isDueForReview(record: SrsRecord | undefined, now = new Date()): boolean {
  if (!record) return true;
  return new Date(record.nextReviewAt).getTime() <= now.getTime();
}

/**
 * Prioritize items for spaced repetition:
 * 1. Due items with lowest mastery & highest wrongCount first
 * 2. Unseen items
 * 3. Future items sorted by earliest nextReviewAt
 */
export function sortByReviewPriority<T extends { id: string }>(
  items: T[],
  srsMap: Record<string, SrsRecord>,
  now = new Date()
): T[] {
  const nowMs = now.getTime();
  return [...items].sort((a, b) => {
    const ra = srsMap[a.id];
    const rb = srsMap[b.id];

    const aDue = ra ? new Date(ra.nextReviewAt).getTime() <= nowMs : false;
    const bDue = rb ? new Date(rb.nextReviewAt).getTime() <= nowMs : false;

    if (aDue !== bDue) return aDue ? -1 : 1;

    if (aDue && bDue && ra && rb) {
      if (ra.mastery !== rb.mastery) return ra.mastery - rb.mastery;
      return rb.wrongCount - ra.wrongCount;
    }

    if (!ra && rb) return -1;
    if (ra && !rb) return 1;
    if (!ra && !rb) return 0;

    return new Date(ra!.nextReviewAt).getTime() - new Date(rb!.nextReviewAt).getTime();
  });
}
