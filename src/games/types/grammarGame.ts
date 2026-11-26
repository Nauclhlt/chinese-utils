export type GrammarGameQuestionType =
  | 'spot'
  | 'replace'
  | 'delete'
  | 'insert'
  | 'reorder'
  | 'rewrite'
  | 'judge'
  | 'multi-error';

export interface GrammarCorrectionQuestion {
  id: string;
  stageId: string;
  type: GrammarGameQuestionType;
  difficulty: 1 | 2 | 3;
  grammarIds: string[];
  lessonId: string;
  promptJa: string;
  /** Sentence split into clickable tokens (for spot/delete/reorder/replace) or full sentence */
  tokens: string[];
  sentenceZh: string;
  /** For spot/delete: indices (0-based) of erroneous token(s) */
  errorIndices?: number[];
  /** For insert: index after which insertion happens (0 = before token 0, tokens.length = at end) */
  insertIndex?: number;
  /** Candidate replacements/insertions or choices for judge/replace/insert */
  choices?: string[];
  /** Canonical corrected Chinese sentence (for judge if correct sentence, same as sentenceZh) */
  correctedSentence: string;
  acceptableSentences: string[];
  /** True if sentence is already grammatically correct (mainly for 'judge') */
  isAlreadyCorrect?: boolean;
  pinyin: string;
  explanation: string;
  pitfallNote: string;
}

export interface GrammarStageMeta {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  isBoss?: boolean;
  grammarIds: string[];
  recommendedLife: number;
  timeLimitSec: number;
}
