import type { GamesPersistState } from '../types/common';

export const GAMES_STORAGE_KEY = 'kyoto_call_chinese_games_v1';
export const GAMES_STATE_VERSION = 1;

export function createDefaultGamesState(): GamesPersistState {
  return {
    version: GAMES_STATE_VERSION,
    globalSettings: {
      bgmVolume: 0.45,
      sfxVolume: 0.7,
      muted: false,
      reducedMotion: false,
    },
    novel: {
      settings: {
        textSpeed: 24,
        autoAdvanceDelayMs: 2200,
        showPinyin: true,
        showJaTranslation: true,
      },
      slots: {},
      readLineIds: [],
      unlockedCgs: [],
      unlockedEndings: [],
    },
    rhythm: {
      settings: {
        noteSpeed: 1.4,
        offsetMs: 0,
        keyBindings: ['1', '2', '3', '4', '5'],
      },
      highScores: {},
    },
    grammarGame: {
      stageRecords: {},
      totalClearedQuestions: 0,
    },
    wordPuzzle: {
      stageRecords: {},
      bestEndlessScore: 0,
      totalSolved: 0,
    },
  };
}

export function loadGamesState(): GamesPersistState {
  try {
    const raw = localStorage.getItem(GAMES_STORAGE_KEY);
    if (!raw) return createDefaultGamesState();
    const parsed = JSON.parse(raw) as Partial<GamesPersistState>;
    const def = createDefaultGamesState();
    return {
      ...def,
      ...parsed,
      globalSettings: { ...def.globalSettings, ...(parsed.globalSettings ?? {}) },
      novel: {
        ...def.novel,
        ...(parsed.novel ?? {}),
        settings: { ...def.novel.settings, ...(parsed.novel?.settings ?? {}) },
        slots: parsed.novel?.slots ?? {},
        readLineIds: Array.isArray(parsed.novel?.readLineIds) ? parsed.novel!.readLineIds : [],
        unlockedCgs: Array.isArray(parsed.novel?.unlockedCgs) ? parsed.novel!.unlockedCgs : [],
        unlockedEndings: Array.isArray(parsed.novel?.unlockedEndings) ? parsed.novel!.unlockedEndings : [],
      },
      rhythm: {
        ...def.rhythm,
        ...(parsed.rhythm ?? {}),
        settings: { ...def.rhythm.settings, ...(parsed.rhythm?.settings ?? {}) },
        highScores: parsed.rhythm?.highScores ?? {},
      },
      grammarGame: {
        ...def.grammarGame,
        ...(parsed.grammarGame ?? {}),
        stageRecords: parsed.grammarGame?.stageRecords ?? {},
      },
      wordPuzzle: {
        ...def.wordPuzzle,
        ...(parsed.wordPuzzle ?? {}),
        stageRecords: parsed.wordPuzzle?.stageRecords ?? {},
      },
    };
  } catch {
    return createDefaultGamesState();
  }
}

export function saveGamesState(state: GamesPersistState): void {
  try {
    localStorage.setItem(GAMES_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}
