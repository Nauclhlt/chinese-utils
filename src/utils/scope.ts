import type { StudyScope } from '../types/user';

export function lessonIdToNumber(lessonId: string | null): number {
  if (!lessonId) return 1;
  const m = lessonId.match(/L(\d+)/i);
  return m ? parseInt(m[1], 10) : 1;
}

export function numberToLessonId(num: number): string {
  return `L${String(num).padStart(2, '0')}`;
}

export function getAllowedLessonNumbers(scope: StudyScope): Set<number> {
  if (scope.mode === 'upTo') {
    const set = new Set<number>();
    for (let i = 1; i <= scope.upToLesson; i++) {
      set.add(i);
    }
    return set;
  }
  return new Set(scope.selectedLessons.map((id) => lessonIdToNumber(id)));
}

export function isLessonInScope(lessonId: string | null, scope: StudyScope, minLesson?: number): boolean {
  const allowed = getAllowedLessonNumbers(scope);
  const targetNum = minLesson ?? lessonIdToNumber(lessonId);

  if (scope.mode === 'upTo') {
    return targetNum <= scope.upToLesson;
  }

  // In custom mode, item's primary lesson must be selected, and its prerequisite minLesson must not exceed max selected
  const primaryNum = lessonIdToNumber(lessonId);
  if (!allowed.has(primaryNum)) return false;
  if (minLesson !== undefined && minLesson > 1) {
    // Allow if minLesson is in allowed or <= max selected lesson
    const maxAllowed = Math.max(0, ...Array.from(allowed));
    return minLesson <= maxAllowed;
  }
  return true;
}

export function filterByScope<T extends { lessonId: string | null; minLesson?: number }>(
  items: T[],
  scope: StudyScope
): T[] {
  return items.filter((item) => isLessonInScope(item.lessonId, scope, item.minLesson));
}

export function formatScopeSummary(scope: StudyScope): string {
  if (scope.mode === 'upTo') {
    return `第1課〜第${scope.upToLesson}課`;
  }
  if (scope.selectedLessons.length === 0) {
    return '課未選択';
  }
  const nums = scope.selectedLessons.map((id) => lessonIdToNumber(id)).sort((a, b) => a - b);
  return `選択課 (${nums.map((n) => `L${n}`).join(', ')})`;
}
