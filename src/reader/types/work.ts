import type { SlotRole } from '../../types/curriculum';

export type ChineseScript = 'zh-Hans' | 'zh-Hant';

export type AnnotationKind = 'vocab' | 'grammar' | 'expression' | 'background';

export type ExpressionSubtype =
  | 'idiom'
  | 'colloquial'
  | 'slang'
  | 'modal-particle'
  | 'ellipsis'
  | 'dialect'
  | 'metaphor'
  | 'literary-diction'
  | 'character-voice'
  | 'nuance';

export type EpistemicLabel = 'fact' | 'common-interpretation' | 'fictional-setting';

export interface VerifiedSource {
  title: string;
  publisher?: string;
  url: string;
  checkedAt: string; // YYYY-MM-DD
  note?: string;
}

export interface StructureSlotRef {
  role:
    | SlotRole
    | 'subject'
    | 'adverb'
    | 'predicate'
    | 'object'
    | 'complement'
    | 'particle'
    | 'modifier'
    | 'conjunction';
  label: string;
  text: string;
  pinyin?: string;
}

export interface ToneInfo {
  syllable: string;
  tone: 1 | 2 | 3 | 4 | 5;
}

export interface GlossaryEntry {
  id: string;
  headword: string;
  pinyin: string;
  tones: ToneInfo[];
  pos: string;
  generalMeaningJa: string;
  wordStructure?: string;
  usageNote?: string;
  synonymDiff?: string;
  examples: { zh: string; pinyin: string; ja: string }[];
  relatedLessonId?: string;
  relatedVocabId?: string;
}

export interface WorkCharacter {
  id: string;
  nameZh: string;
  pinyin: string;
  nameJa: string;
  role: string;
  speechStyle: string;
  description: string;
  revealFromChapterIndex: number;
  spoilerDescription?: string;
}

export interface BackgroundNote {
  id: string;
  category:
    | 'education'
    | 'festival'
    | 'geography'
    | 'history'
    | 'custom'
    | 'literature'
    | 'culture'
    | 'science'
    | 'architecture';
  title: string;
  summary: string;
  detail: string;
  factType: EpistemicLabel;
  revealFromChapterIndex: number;
  spoilerDetail?: string;
  sources: VerifiedSource[];
}

export interface TimelineEntry {
  id: string;
  label: string;
  description: string;
  revealFromChapterIndex: number;
}

export interface VocabAnnotationPayload {
  glossaryId: string;
  surface: string;
  contextualPinyin: string;
  contextualTones?: ToneInfo[];
  contextualMeaningJa: string;
  contextualNote?: string;
}

export interface GrammarAnnotationPayload {
  title: string;
  pattern: string;
  structureSummary: string;
  slots?: StructureSlotRef[];
  roleExplanation: string;
  wordOrderReason?: string;
  particleOrAspectNote?: string;
  literalVsNaturalJa?: { literal: string; natural: string };
  comparisonNote?: string;
  extraExamples?: { zh: string; pinyin: string; ja: string }[];
  relatedGrammarId?: string;
}

export interface ExpressionAnnotationPayload {
  subtype: ExpressionSubtype;
  subtypeLabelJa: string;
  meaningJa: string;
  nuanceNote: string;
  factType: EpistemicLabel;
}

export interface BackgroundAnnotationPayload {
  backgroundNoteId: string;
  shortHintJa: string;
}

export interface InlineAnnotation {
  id: string;
  kind: AnnotationKind;
  /** UTF-16 code unit start index in sentence.text (inclusive) */
  start: number;
  /** UTF-16 code unit end index in sentence.text (exclusive) */
  end: number;
  /** Exact substring: sentence.text.slice(start, end) === surface */
  surface: string;
  revealFromChapterIndex?: number;
  spoilerNote?: string;
  vocab?: VocabAnnotationPayload;
  grammar?: GrammarAnnotationPayload;
  expression?: ExpressionAnnotationPayload;
  background?: BackgroundAnnotationPayload;
}

export interface WorkSentence {
  id: string;
  text: string;
  pinyin: string;
  translationJa: string;
  audioUrl?: string;
  speaker?: string;
  annotations: InlineAnnotation[];
}

export interface WorkParagraph {
  id: string;
  kind: 'narrative' | 'dialogue' | 'letter' | 'quote' | 'heading';
  sentences: WorkSentence[];
}

export interface WorkComprehensionQuiz {
  id: string;
  promptJa: string;
  choices: string[];
  answerIndex: number;
  explanationJa: string;
}

export interface WorkChapter {
  id: string;
  index: number; // 0-based
  number: number; // 1-based display
  titleZh: string;
  titlePinyin: string;
  titleJa: string;
  summaryNoSpoiler: string;
  paragraphs: WorkParagraph[];
  quiz?: WorkComprehensionQuiz[];
}

export interface WorkPracticeItem {
  id: string;
  kind: 'tone' | 'word-order' | 'grammar';
  chapterId: string;
  promptJa: string;
  targetZh: string;
  pinyin?: string;
  chunks?: string[];
  choices?: string[];
  answer: string;
  acceptableAnswers?: string[];
  explanationJa: string;
  relatedGrammarId?: string;
}

export interface WorkMetadata {
  id: string;
  titleZh: string;
  titlePinyin: string;
  titleJa: string;
  subtitle?: string;
  author: string;
  authorNote?: string;
  script: ChineseScript;
  genres: string[];
  synopsis: string;
  coverImage?: string;
  coverAlt?: string;
  estimatedDifficulty: string;
  difficultyBasis: string;
  charCount: number;
  chapterCount: number;
  rights: {
    status: 'original' | 'public-domain' | 'licensed' | 'personal-local';
    notice: string;
    redistributableInRepo: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LiteratureWork {
  schemaVersion: '1.0.0';
  metadata: WorkMetadata;
  characters: WorkCharacter[];
  backgroundNotes: BackgroundNote[];
  timeline?: TimelineEntry[];
  glossary: GlossaryEntry[];
  chapters: WorkChapter[];
  practiceItems?: WorkPracticeItem[];
}

export interface BundledOrLocalWorkEntry {
  work: LiteratureWork;
  origin: 'bundled' | 'local';
  importedAt?: string;
}

export type ReaderDisplayMode = 'reading' | 'intensive' | 'bilingual' | 'pinyin' | 'listening';
export type ReaderTheme = 'light' | 'dark' | 'sepia';
export type ReaderFontFamily = 'serif' | 'sans' | 'kai';
export type ReaderContentWidth = 'narrow' | 'medium' | 'wide';

export interface ReaderSettings {
  displayMode: ReaderDisplayMode;
  showPinyin: boolean;
  showTranslation: boolean;
  showVocabMarkers: boolean;
  showGrammarMarkers: boolean;
  showExpressionMarkers: boolean;
  showBackgroundMarkers: boolean;
  dimMasteredVocab: boolean;
  allowSpoilers: boolean;
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  fontSizePx: number;
  lineHeight: number;
  contentWidth: ReaderContentWidth;
  speechRate: number;
  focusMode: boolean;
}

export interface WorkBookmark {
  id: string;
  workId: string;
  chapterIndex: number;
  sentenceId: string;
  excerpt: string;
  note?: string;
  createdAt: string;
}

export interface WorkProgressRecord {
  workId: string;
  currentChapterIndex: number;
  currentSentenceId: string | null;
  maxReachedChapterIndex: number;
  completed: boolean;
  lastReadAt: string;
  bookmarks: WorkBookmark[];
}

export interface LookupHistoryItem {
  id: string;
  workId: string;
  workTitleZh: string;
  chapterIndex: number;
  kind: AnnotationKind;
  surface: string;
  pinyin?: string;
  meaningJa: string;
  lookedUpAt: string;
}

export interface FavoriteSentenceItem {
  id: string;
  workId: string;
  workTitleZh: string;
  chapterIndex: number;
  sentenceId: string;
  text: string;
  pinyin: string;
  translationJa: string;
  savedAt: string;
}

export interface ReaderVocabReviewItem {
  id: string; // `${workId}::${glossaryId}`
  workId: string;
  workTitleZh: string;
  glossaryId: string;
  word: string;
  pinyin: string;
  pos: string;
  meaningJa: string;
  contextualNote?: string;
  relatedLessonId?: string;
  addedAt: string;
}

export interface ReaderGrammarReviewItem {
  id: string;
  workId: string;
  workTitleZh: string;
  title: string;
  pattern: string;
  explanationJa: string;
  relatedGrammarId?: string;
  addedAt: string;
}

export interface ReaderUserState {
  version: number;
  settings: ReaderSettings;
  progressByWork: Record<string, WorkProgressRecord>;
  favoriteWorkIds: string[];
  lookupHistory: LookupHistoryItem[];
  favoriteSentences: FavoriteSentenceItem[];
  vocabReview: ReaderVocabReviewItem[];
  grammarReview: ReaderGrammarReviewItem[];
}
