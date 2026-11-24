import { describe, expect, it } from 'vitest';
import { filterByScope, formatScopeSummary, isLessonInScope } from '../../src/utils/scope';
import type { StudyScope } from '../../src/types/user';

const sampleItems = [
  { id: '1', lessonId: 'L01', minLesson: 1 },
  { id: '2', lessonId: 'L08', minLesson: 8 },
  { id: '3', lessonId: 'L14', minLesson: 14 },
  { id: '4', lessonId: 'L15', minLesson: 15 },
  { id: '5', lessonId: 'L22', minLesson: 22 },
];

describe('study scope control', () => {
  it('excludes lessons beyond upToLesson in upTo mode', () => {
    const scope: StudyScope = { mode: 'upTo', upToLesson: 14, selectedLessons: [] };
    const filtered = filterByScope(sampleItems, scope);
    expect(filtered.map((x) => x.id)).toEqual(['1', '2', '3']);
    expect(isLessonInScope('L15', scope, 15)).toBe(false);
    expect(isLessonInScope('L14', scope, 14)).toBe(true);
    expect(formatScopeSummary(scope)).toBe('第1課〜第14課');
  });

  it('filters strictly to selectedLessons in custom mode', () => {
    const scope: StudyScope = { mode: 'custom', upToLesson: 22, selectedLessons: ['L01', 'L08'] };
    const filtered = filterByScope(sampleItems, scope);
    expect(filtered.map((x) => x.id)).toEqual(['1', '2']);
    expect(isLessonInScope('L08', scope, 8)).toBe(true);
    expect(isLessonInScope('L14', scope, 14)).toBe(false);
  });

  it('blocks item if minLesson exceeds max selected lesson', () => {
    const scope: StudyScope = { mode: 'custom', upToLesson: 10, selectedLessons: ['L05'] };
    expect(isLessonInScope('L05', scope, 10)).toBe(false);
  });
});
