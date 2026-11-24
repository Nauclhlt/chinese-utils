import type {
  ComparisonGuide,
  CompositionItem,
  ExerciseItem,
  GrammarCategory,
  GrammarPoint,
  LessonMeta,
  PronunciationData,
  VocabularyItem,
} from '../types/curriculum';

import categoriesRaw from './categories.json';
import lessonsRaw from './lessons.json';
import comparisonsRaw from './comparisons.json';
import pronunciationRaw from './pronunciation.json';

const grammarModules = import.meta.glob<{ default: GrammarPoint[] }>('./grammar/*.json', { eager: true });
const vocabModules = import.meta.glob<{ default: VocabularyItem[] }>('./vocab/*.json', { eager: true });
const exerciseModules = import.meta.glob<{ default: ExerciseItem[] }>('./exercises/*.json', { eager: true });
const compositionModules = import.meta.glob<{ default: CompositionItem[] }>('./compositions/*.json', { eager: true });

export const categories: GrammarCategory[] = [...(categoriesRaw as GrammarCategory[])].sort(
  (a, b) => a.order - b.order
);

export const lessons: LessonMeta[] = [...(lessonsRaw as LessonMeta[])].sort(
  (a, b) => a.number - b.number
);

export const comparisons: ComparisonGuide[] = comparisonsRaw as ComparisonGuide[];

export const pronunciationData: PronunciationData = pronunciationRaw as PronunciationData;

export const grammarPoints: GrammarPoint[] = Object.entries(grammarModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([, mod]) => (Array.isArray(mod.default) ? mod.default : (mod as unknown as GrammarPoint[])));

export const vocabulary: VocabularyItem[] = Object.entries(vocabModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([, mod]) => (Array.isArray(mod.default) ? mod.default : (mod as unknown as VocabularyItem[])));

export const exercises: ExerciseItem[] = Object.entries(exerciseModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([, mod]) => (Array.isArray(mod.default) ? mod.default : (mod as unknown as ExerciseItem[])));

export const compositions: CompositionItem[] = Object.entries(compositionModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([, mod]) => (Array.isArray(mod.default) ? mod.default : (mod as unknown as CompositionItem[])));

export const lessonMap = new Map(lessons.map((l) => [l.id, l]));
export const categoryMap = new Map(categories.map((c) => [c.id, c]));
export const grammarMap = new Map(grammarPoints.map((g) => [g.id, g]));
export const vocabMap = new Map(vocabulary.map((v) => [v.id, v]));
export const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
export const compositionMap = new Map(compositions.map((c) => [c.id, c]));

export function getLessonById(id: string): LessonMeta | undefined {
  return lessonMap.get(id);
}

export function getGrammarById(id: string): GrammarPoint | undefined {
  return grammarMap.get(id);
}

export function getGrammarByLesson(lessonId: string): GrammarPoint[] {
  return grammarPoints.filter((g) => g.lessonId === lessonId);
}

export function getVocabByLesson(lessonId: string): VocabularyItem[] {
  return vocabulary.filter((v) => v.lessonId === lessonId);
}

export function getExercisesByLesson(lessonId: string): ExerciseItem[] {
  return exercises.filter((e) => e.lessonId === lessonId);
}

export function getExercisesByGrammar(grammarId: string): ExerciseItem[] {
  return exercises.filter((e) => e.grammarIds.includes(grammarId));
}

export function getCompositionsByGrammar(grammarId: string): CompositionItem[] {
  return compositions.filter((c) => c.grammarIds.includes(grammarId));
}
