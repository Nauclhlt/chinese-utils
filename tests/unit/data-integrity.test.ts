import { describe, expect, it } from 'vitest';
import {
  categories,
  compositions,
  exercises,
  grammarPoints,
  lessons,
  vocabulary,
} from '../../src/data';

describe('curriculum JSON data integrity', () => {
  it('covers all 22 lessons and minimum content thresholds', () => {
    expect(lessons).toHaveLength(22);
    expect(categories.length).toBeGreaterThanOrEqual(15);
    const primaryGrammar = grammarPoints.filter((g) => !g.isSupplementary);
    expect(primaryGrammar.length).toBeGreaterThanOrEqual(90);
    expect(vocabulary.length).toBeGreaterThanOrEqual(400);

    for (const g of primaryGrammar) {
      expect(g.examples.length).toBeGreaterThanOrEqual(5);
      expect(exercises.filter((e) => e.grammarIds.includes(g.id)).length).toBeGreaterThanOrEqual(10);
      expect(compositions.filter((c) => c.grammarIds.includes(g.id)).length).toBeGreaterThanOrEqual(5);
    }

    for (const l of lessons) {
      expect(
        exercises.filter((e) => e.lessonId === l.id && e.isLessonComprehensive).length
      ).toBeGreaterThanOrEqual(10);
    }
  });
});
