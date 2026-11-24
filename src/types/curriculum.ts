export type SlotRole =
  | 'S'
  | 'V'
  | 'O'
  | 'C'
  | 'Adv'
  | 'Attr'
  | 'P'
  | 'Aux'
  | 'Neg'
  | 'Conj'
  | 'Time'
  | 'Loc'
  | 'Prep'
  | 'Other';

export interface StructureSlot {
  role: SlotRole;
  label: string;
  text: string;
  pinyin?: string;
}

export interface ExampleSentence {
  id: string;
  hanzi: string;
  pinyin: string;
  ja: string;
  note?: string;
  breakdown?: StructureSlot[];
}

export interface SimilarDifference {
  targetId?: string;
  targetName: string;
  difference: string;
}

export interface GrammarPoint {
  id: string;
  title: string;
  categoryId: string;
  lessonId: string;
  difficulty: 1 | 2 | 3;
  isSupplementary?: boolean;
  prerequisites: string[];
  relatedIds: string[];
  meaning: string;
  pattern: string;
  structureSlots: StructureSlot[];
  wordOrderNote: string;
  usageConditions: string;
  distinctionNotes: string;
  forms?: {
    affirmative?: string;
    negative?: string;
    interrogative?: string;
  };
  japaneseLearnerPitfalls: string[];
  similarDifferences: SimilarDifference[];
  examples: ExampleSentence[];
  referenceUrl: string;
  referenceTitle: string;
}

export interface GrammarCategory {
  id: string;
  name: string;
  description: string;
  order: number;
}

export interface LessonMeta {
  id: string;
  number: number;
  title: string;
  topic: string;
  objectives: string[];
  grammarIds: string[];
  referenceUrl: string;
  referenceTocUrl: string;
  pronunciationFocus?: string;
}

export interface VocabularyItem {
  id: string;
  hanzi: string;
  pinyin: string;
  tones: number[];
  meaningJa: string;
  pos: string;
  usage: string;
  example: {
    hanzi: string;
    pinyin: string;
    ja: string;
  };
  lessonId: string | null;
  minLesson: number;
  source: 'textbook-scope' | 'supplement';
  grammarIds: string[];
  synonyms?: string[];
  antonyms?: string[];
  related?: string[];
  measureWord?: string;
}

export type ExerciseType =
  | 'fill-blank'
  | 'multiple-choice'
  | 'word-order'
  | 'error-correction'
  | 'true-false'
  | 'distinction'
  | 'combined';

export interface ExerciseItem {
  id: string;
  lessonId: string;
  minLesson: number;
  grammarIds: string[];
  type: ExerciseType;
  difficulty: 1 | 2 | 3;
  prompt: string;
  promptPinyin?: string;
  promptJa?: string;
  choices?: string[];
  tokens?: string[];
  answer: string | string[];
  acceptableAnswers?: string[];
  explanation: string;
  grammarRuleNote: string;
  isLessonComprehensive?: boolean;
}

export interface CompositionMistake {
  wrong: string;
  reason: string;
}

export interface CompositionItem {
  id: string;
  lessonId: string;
  minLesson: number;
  grammarIds: string[];
  difficulty: 1 | 2 | 3;
  japanesePrompt: string;
  targetGrammarHint: string;
  hints: [string, string, string];
  modelAnswer: string;
  acceptableAnswers: string[];
  pinyin: string;
  structureBreakdown: StructureSlot[];
  explanation: string;
  commonMistakes: CompositionMistake[];
}

export interface ComparisonRow {
  item: string;
  meaning: string;
  usage: string;
  negation: string;
  example: {
    hanzi: string;
    pinyin: string;
    ja: string;
  };
}

export interface ComparisonGuide {
  id: string;
  title: string;
  summary: string;
  grammarIds: string[];
  isSupplementary?: boolean;
  rows: ComparisonRow[];
  keyPoints: string[];
}

export interface PinyinPairDrill {
  id: string;
  lessonId: string;
  minLesson: number;
  category: 'similar-sound' | 'tone-sandhi' | 'neutral-tone' | 'retroflex';
  prompt: string;
  optionA: { hanzi: string; pinyin: string; ja: string };
  optionB: { hanzi: string; pinyin: string; ja: string };
  target: 'A' | 'B';
  explanation: string;
}

export interface ToneSandhiRule {
  id: string;
  title: string;
  description: string;
  examples: {
    hanzi: string;
    originalPinyin: string;
    spokenPinyin: string;
    ja: string;
    note: string;
  }[];
}

export interface PronunciationData {
  sandhiRules: ToneSandhiRule[];
  pairDrills: PinyinPairDrill[];
}
