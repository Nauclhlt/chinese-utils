import type { VocabularyItem } from '../types/curriculum';
import type { UserState } from '../types/user';

export const STORAGE_KEY = 'kyoto_call_chinese_user_state_v1';
export const CURRENT_STATE_VERSION = 1;

export function createDefaultUserState(): UserState {
  return {
    version: CURRENT_STATE_VERSION,
    scope: {
      mode: 'upTo',
      upToLesson: 22,
      selectedLessons: ['L01', 'L02', 'L03', 'L04', 'L05'],
    },
    completedLessons: [],
    studiedGrammarIds: [],
    favoritesVocab: [],
    bookmarkedGrammar: [],
    grammarNotes: {},
    srs: {},
    answerHistory: [],
    compositionHistory: [],
    studySecondsTotal: 0,
    studySessions: [],
    settings: {
      theme: 'light',
      showPinyin: true,
      toneColors: true,
      speechRate: 0.9,
      scopeConfigured: false,
      lastVisitedPath: '/',
      lastVisitedLabel: 'ホーム',
    },
    customVocab: [],
    customExercises: [],
  };
}

export function loadUserState(): { state: UserState; corrupted: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { state: createDefaultUserState(), corrupted: false };
    }
    const parsed = JSON.parse(raw);
    const validated = validateImportedUserState(parsed);
    if (!validated.valid || !validated.data) {
      return { state: createDefaultUserState(), corrupted: true };
    }
    return { state: validated.data, corrupted: false };
  } catch {
    return { state: createDefaultUserState(), corrupted: true };
  }
}

export function saveUserState(state: UserState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors cleanly
  }
}

export function validateImportedUserState(input: unknown): {
  valid: boolean;
  data?: UserState;
  error?: string;
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, error: 'JSONのルートがオブジェクトではありません。' };
  }
  const obj = input as Record<string, unknown>;
  if (typeof obj.version !== 'number') {
    return { valid: false, error: 'version フィールドが不正または欠落しています。' };
  }
  if (!obj.scope || typeof obj.scope !== 'object') {
    return { valid: false, error: 'scope（学習範囲設定）が不正または欠落しています。' };
  }
  const scope = obj.scope as Record<string, unknown>;
  if (scope.mode !== 'upTo' && scope.mode !== 'custom') {
    return { valid: false, error: 'scope.mode は "upTo" または "custom" である必要があります。' };
  }
  if (typeof scope.upToLesson !== 'number' || scope.upToLesson < 1 || scope.upToLesson > 22) {
    return { valid: false, error: 'scope.upToLesson は 1〜22 の数値である必要があります。' };
  }
  if (!Array.isArray(scope.selectedLessons)) {
    return { valid: false, error: 'scope.selectedLessons は配列である必要があります。' };
  }

  const defaults = createDefaultUserState();
  const merged: UserState = {
    ...defaults,
    version: CURRENT_STATE_VERSION,
    scope: {
      mode: scope.mode,
      upToLesson: scope.upToLesson,
      selectedLessons: scope.selectedLessons.filter((x): x is string => typeof x === 'string'),
    },
    completedLessons: Array.isArray(obj.completedLessons)
      ? obj.completedLessons.filter((x): x is string => typeof x === 'string')
      : [],
    studiedGrammarIds: Array.isArray(obj.studiedGrammarIds)
      ? obj.studiedGrammarIds.filter((x): x is string => typeof x === 'string')
      : [],
    favoritesVocab: Array.isArray(obj.favoritesVocab)
      ? obj.favoritesVocab.filter((x): x is string => typeof x === 'string')
      : [],
    bookmarkedGrammar: Array.isArray(obj.bookmarkedGrammar)
      ? obj.bookmarkedGrammar.filter((x): x is string => typeof x === 'string')
      : [],
    grammarNotes:
      obj.grammarNotes && typeof obj.grammarNotes === 'object' && !Array.isArray(obj.grammarNotes)
        ? (obj.grammarNotes as Record<string, string>)
        : {},
    srs:
      obj.srs && typeof obj.srs === 'object' && !Array.isArray(obj.srs)
        ? (obj.srs as UserState['srs'])
        : {},
    answerHistory: Array.isArray(obj.answerHistory) ? (obj.answerHistory as UserState['answerHistory']) : [],
    compositionHistory: Array.isArray(obj.compositionHistory)
      ? (obj.compositionHistory as UserState['compositionHistory'])
      : [],
    studySecondsTotal: typeof obj.studySecondsTotal === 'number' ? obj.studySecondsTotal : 0,
    studySessions: Array.isArray(obj.studySessions) ? (obj.studySessions as UserState['studySessions']) : [],
    settings:
      obj.settings && typeof obj.settings === 'object'
        ? { ...defaults.settings, ...(obj.settings as Partial<UserState['settings']>) }
        : defaults.settings,
    customVocab: Array.isArray(obj.customVocab) ? (obj.customVocab as UserState['customVocab']) : [],
    customExercises: Array.isArray(obj.customExercises)
      ? (obj.customExercises as UserState['customExercises'])
      : [],
  };

  return { valid: true, data: merged };
}

function escapeCsvCell(val: string): string {
  const safe = val.replace(/"/g, '""');
  return `"${safe}"`;
}

export function exportVocabToCsv(items: VocabularyItem[]): string {
  const header = ['ID', '簡体字', 'ピンイン', '日本語訳', '品詞', '課', '例文(中国語)', '例文(ピンイン)', '例文(日本語)'];
  const rows = items.map((v) =>
    [
      v.id,
      v.hanzi,
      v.pinyin,
      v.meaningJa,
      v.pos,
      v.lessonId ?? '補足語彙',
      v.example.hanzi,
      v.example.pinyin,
      v.example.ja,
    ]
      .map(escapeCsvCell)
      .join(',')
  );
  return '\uFEFF' + [header.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}

export function exportVocabToAnkiTsv(items: VocabularyItem[]): string {
  // Anki TSV: Front (Hanzi) \t Back (Pinyin + Meaning + Example) \t Tags
  return items
    .map((v) => {
      const front = v.hanzi;
      const back = `${v.pinyin}<br>${v.meaningJa}<br><small>${v.example.hanzi} (${v.example.pinyin}) — ${v.example.ja}</small>`;
      const tags = `chinese ${v.lessonId ?? 'supplement'} ${v.pos}`;
      return [front, back, tags].map((s) => s.replace(/[\t\r\n]+/g, ' ')).join('\t');
    })
    .join('\n');
}
