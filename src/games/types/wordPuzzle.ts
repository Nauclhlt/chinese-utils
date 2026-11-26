import type { StructureSlot } from '../../types/curriculum';

export interface WordPuzzleChunk {
  id: string;
  pinyinMarked: string;
  pinyinPlain: string;
  hanzi: string;
  acceptableHanzi?: string[];
  meaningHint?: string;
  isDistractor?: boolean;
}

export interface WordPuzzleQuestion {
  id: string;
  stageId: string;
  difficulty: 1 | 2 | 3;
  grammarIds: string[];
  lessonId: string;
  japanesePrompt: string;
  chunks: WordPuzzleChunk[];
  /** Ordered chunk IDs forming the canonical sentence (excluding distractors) */
  correctOrderIds: string[];
  modelAnswer: string;
  acceptableAnswers: string[];
  fullPinyin: string;
  structureBreakdown: StructureSlot[];
  explanation: string;
}

export interface WordPuzzleStageMeta {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  isBoss?: boolean;
  hideToneMarksByDefault?: boolean;
  hasDistractors?: boolean;
  grammarIds: string[];
}
