export type StudyScopeMode = 'upTo' | 'custom';

export interface StudyScope {
  mode: StudyScopeMode;
  upToLesson: number;
  selectedLessons: string[];
}

export type SrsRating = 'again' | 'hard' | 'good' | 'easy';

export interface SrsRecord {
  id: string;
  kind: 'vocab' | 'grammar' | 'exercise' | 'composition';
  mastery: number; // 0 to 100
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lastReviewedAt: string;
  nextReviewAt: string;
  correctCount: number;
  wrongCount: number;
}

export interface AnswerHistoryEntry {
  id: string;
  itemId: string;
  itemKind: 'exercise' | 'pinyin' | 'listening' | 'flashcard' | 'exam';
  lessonId: string;
  grammarIds: string[];
  correct: boolean;
  userAnswer: string;
  timestamp: string;
}

export type CompositionSelfScore = 'correct' | 'partial' | 'wrong';

export interface CompositionHistoryEntry {
  id: string;
  compositionId: string;
  lessonId: string;
  grammarIds: string[];
  userInput: string;
  matchedModel: boolean;
  selfScore: CompositionSelfScore | null;
  timestamp: string;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  showPinyin: boolean;
  toneColors: boolean;
  speechRate: number;
  scopeConfigured: boolean;
  lastVisitedPath: string;
  lastVisitedLabel: string;
}

export interface UserVocabNote {
  id: string;
  hanzi: string;
  pinyin: string;
  meaningJa: string;
  pos: string;
  lessonId: string | null;
  exampleJa?: string;
  exampleHanzi?: string;
  createdAt: string;
}

export interface UserCustomExercise {
  id: string;
  lessonId: string;
  grammarIds: string[];
  prompt: string;
  choices: string[];
  answer: string;
  explanation: string;
  createdAt: string;
}

export interface UserState {
  version: number;
  scope: StudyScope;
  completedLessons: string[];
  studiedGrammarIds: string[];
  favoritesVocab: string[];
  bookmarkedGrammar: string[];
  grammarNotes: Record<string, string>;
  srs: Record<string, SrsRecord>;
  answerHistory: AnswerHistoryEntry[];
  compositionHistory: CompositionHistoryEntry[];
  studySecondsTotal: number;
  studySessions: { date: string; seconds: number }[];
  settings: UserSettings;
  customVocab: UserVocabNote[];
  customExercises: UserCustomExercise[];
}
