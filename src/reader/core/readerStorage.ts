import type {
  AnnotationKind,
  FavoriteSentenceItem,
  LookupHistoryItem,
  ReaderDisplayMode,
  ReaderGrammarReviewItem,
  ReaderSettings,
  ReaderUserState,
  ReaderVocabReviewItem,
  WorkBookmark,
  WorkProgressRecord,
} from '../types/work';

export const READER_STORAGE_KEY = 'kyoto_call_chinese_reader_state_v1';

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  displayMode: 'intensive',
  showPinyin: false,
  showTranslation: false,
  showVocabMarkers: true,
  showGrammarMarkers: true,
  showExpressionMarkers: true,
  showBackgroundMarkers: true,
  dimMasteredVocab: true,
  allowSpoilers: false,
  theme: 'sepia',
  fontFamily: 'serif',
  fontSizePx: 19,
  lineHeight: 2.0,
  contentWidth: 'medium',
  speechRate: 0.9,
  focusMode: false,
};

export function createDefaultReaderState(): ReaderUserState {
  return {
    version: 1,
    settings: { ...DEFAULT_READER_SETTINGS },
    progressByWork: {},
    favoriteWorkIds: [],
    lookupHistory: [],
    favoriteSentences: [],
    vocabReview: [],
    grammarReview: [],
  };
}

export function loadReaderState(): ReaderUserState {
  try {
    const raw = localStorage.getItem(READER_STORAGE_KEY);
    if (!raw) return createDefaultReaderState();
    const parsed = JSON.parse(raw) as Partial<ReaderUserState>;
    if (!parsed || typeof parsed !== 'object') return createDefaultReaderState();
    return {
      version: 1,
      settings: { ...DEFAULT_READER_SETTINGS, ...(parsed.settings ?? {}) },
      progressByWork: parsed.progressByWork ?? {},
      favoriteWorkIds: Array.isArray(parsed.favoriteWorkIds) ? parsed.favoriteWorkIds : [],
      lookupHistory: Array.isArray(parsed.lookupHistory) ? parsed.lookupHistory : [],
      favoriteSentences: Array.isArray(parsed.favoriteSentences) ? parsed.favoriteSentences : [],
      vocabReview: Array.isArray(parsed.vocabReview) ? parsed.vocabReview : [],
      grammarReview: Array.isArray(parsed.grammarReview) ? parsed.grammarReview : [],
    };
  } catch {
    return createDefaultReaderState();
  }
}

export function saveReaderState(state: ReaderUserState): void {
  try {
    localStorage.setItem(READER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function applyDisplayModePreset(
  prev: ReaderSettings,
  mode: ReaderDisplayMode
): ReaderSettings {
  switch (mode) {
    case 'reading':
      return {
        ...prev,
        displayMode: mode,
        showPinyin: false,
        showTranslation: false,
        showVocabMarkers: true,
        showGrammarMarkers: false,
        showExpressionMarkers: true,
        showBackgroundMarkers: true,
      };
    case 'intensive':
      return {
        ...prev,
        displayMode: mode,
        showPinyin: prev.showPinyin,
        showTranslation: prev.showTranslation,
        showVocabMarkers: true,
        showGrammarMarkers: true,
        showExpressionMarkers: true,
        showBackgroundMarkers: true,
      };
    case 'bilingual':
      return {
        ...prev,
        displayMode: mode,
        showTranslation: true,
      };
    case 'pinyin':
      return {
        ...prev,
        displayMode: mode,
        showPinyin: true,
      };
    case 'listening':
      return {
        ...prev,
        displayMode: mode,
      };
  }
}

export function upsertWorkProgress(
  state: ReaderUserState,
  workId: string,
  chapterIndex: number,
  sentenceId: string | null,
  totalChapters: number,
  markCompleted = false
): ReaderUserState {
  const existing = state.progressByWork[workId];
  const maxReached = Math.max(existing?.maxReachedChapterIndex ?? 0, chapterIndex);
  const completed = Boolean(
    existing?.completed || markCompleted || (totalChapters > 0 && chapterIndex >= totalChapters - 1 && markCompleted)
  );
  const nextRecord: WorkProgressRecord = {
    workId,
    currentChapterIndex: chapterIndex,
    currentSentenceId: sentenceId ?? existing?.currentSentenceId ?? null,
    maxReachedChapterIndex: maxReached,
    completed,
    lastReadAt: new Date().toISOString(),
    bookmarks: existing?.bookmarks ?? [],
  };
  return {
    ...state,
    progressByWork: { ...state.progressByWork, [workId]: nextRecord },
  };
}

export function addBookmarkToWork(
  state: ReaderUserState,
  workId: string,
  chapterIndex: number,
  sentenceId: string,
  excerpt: string,
  note?: string
): ReaderUserState {
  const existing = state.progressByWork[workId] ?? {
    workId,
    currentChapterIndex: chapterIndex,
    currentSentenceId: sentenceId,
    maxReachedChapterIndex: chapterIndex,
    completed: false,
    lastReadAt: new Date().toISOString(),
    bookmarks: [],
  };
  const already = existing.bookmarks.find(
    (b) => b.chapterIndex === chapterIndex && b.sentenceId === sentenceId
  );
  if (already) return state;

  const bm: WorkBookmark = {
    id: `bm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    workId,
    chapterIndex,
    sentenceId,
    excerpt: excerpt.slice(0, 60),
    note,
    createdAt: new Date().toISOString(),
  };
  return {
    ...state,
    progressByWork: {
      ...state.progressByWork,
      [workId]: { ...existing, bookmarks: [bm, ...existing.bookmarks] },
    },
  };
}

export function removeBookmarkFromWork(
  state: ReaderUserState,
  workId: string,
  bookmarkId: string
): ReaderUserState {
  const existing = state.progressByWork[workId];
  if (!existing) return state;
  return {
    ...state,
    progressByWork: {
      ...state.progressByWork,
      [workId]: {
        ...existing,
        bookmarks: existing.bookmarks.filter((b) => b.id !== bookmarkId),
      },
    },
  };
}

export function recordLookupHistory(
  state: ReaderUserState,
  entry: Omit<LookupHistoryItem, 'id' | 'lookedUpAt'>
): ReaderUserState {
  const recent = state.lookupHistory.find(
    (h) =>
      h.workId === entry.workId &&
      h.kind === entry.kind &&
      h.surface === entry.surface
  );
  const item: LookupHistoryItem = {
    ...entry,
    id: `lkp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    lookedUpAt: new Date().toISOString(),
  };
  const filtered = recent ? state.lookupHistory.filter((h) => h.id !== recent.id) : state.lookupHistory;
  return {
    ...state,
    lookupHistory: [item, ...filtered].slice(0, 200),
  };
}

export function toggleFavoriteSentence(
  state: ReaderUserState,
  item: Omit<FavoriteSentenceItem, 'id' | 'savedAt'>
): ReaderUserState {
  const exists = state.favoriteSentences.find(
    (s) => s.workId === item.workId && s.sentenceId === item.sentenceId
  );
  if (exists) {
    return {
      ...state,
      favoriteSentences: state.favoriteSentences.filter((s) => s.id !== exists.id),
    };
  }
  const added: FavoriteSentenceItem = {
    ...item,
    id: `favs_${item.workId}_${item.sentenceId}`,
    savedAt: new Date().toISOString(),
  };
  return {
    ...state,
    favoriteSentences: [added, ...state.favoriteSentences],
  };
}

export function addReaderVocabToReview(
  state: ReaderUserState,
  item: Omit<ReaderVocabReviewItem, 'addedAt'>
): ReaderUserState {
  if (state.vocabReview.some((v) => v.id === item.id)) return state;
  return {
    ...state,
    vocabReview: [{ ...item, addedAt: new Date().toISOString() }, ...state.vocabReview],
  };
}

export function removeReaderVocabFromReview(state: ReaderUserState, id: string): ReaderUserState {
  return {
    ...state,
    vocabReview: state.vocabReview.filter((v) => v.id !== id),
  };
}

export function addReaderGrammarToReview(
  state: ReaderUserState,
  item: Omit<ReaderGrammarReviewItem, 'addedAt'>
): ReaderUserState {
  if (state.grammarReview.some((g) => g.id === item.id)) return state;
  return {
    ...state,
    grammarReview: [{ ...item, addedAt: new Date().toISOString() }, ...state.grammarReview],
  };
}

export function removeReaderGrammarFromReview(state: ReaderUserState, id: string): ReaderUserState {
  return {
    ...state,
    grammarReview: state.grammarReview.filter((g) => g.id !== id),
  };
}

export function labelAnnotationKind(kind: AnnotationKind): string {
  switch (kind) {
    case 'vocab':
      return '語彙';
    case 'grammar':
      return '文法';
    case 'expression':
      return '表現・文学';
    case 'background':
      return '背景知識';
  }
}
