export interface GameGlobalSettings {
  bgmVolume: number; // 0..1
  sfxVolume: number; // 0..1
  muted: boolean;
  reducedMotion: boolean;
}

export interface NovelSaveSlot {
  slotId: string; // 'auto' | 'quick' | 'slot1'..'slot6'
  savedAt: string;
  chapterId: string;
  lineId: string;
  speaker: string;
  previewText: string;
  flags: Record<string, string | number | boolean>;
  visitedLineIds: string[];
  unlockedCgs: string[];
}

export interface NovelSettings {
  textSpeed: number; // ms per char (12..60)
  autoAdvanceDelayMs: number;
  showPinyin: boolean;
  showJaTranslation: boolean;
}

export interface RhythmHighScore {
  songId: string;
  difficulty: 'easy' | 'normal' | 'hard';
  mode: string;
  score: number;
  accuracy: number;
  maxCombo: number;
  rank: 'S' | 'A' | 'B' | 'C';
  updatedAt: string;
}

export interface RhythmSettings {
  noteSpeed: number; // 1.0..2.5
  offsetMs: number; // -150..+150
  keyBindings: [string, string, string, string, string]; // 1st, 2nd, 3rd, 4th, 5th(neutral)
}

export interface StageBestRecord {
  stageId: string;
  bestScore: number;
  bestAccuracy: number;
  stars: 0 | 1 | 2 | 3;
  cleared: boolean;
  updatedAt: string;
}

export interface GamesPersistState {
  version: number;
  globalSettings: GameGlobalSettings;
  novel: {
    settings: NovelSettings;
    slots: Record<string, NovelSaveSlot>;
    readLineIds: string[];
    unlockedCgs: string[];
    unlockedEndings: string[];
  };
  rhythm: {
    settings: RhythmSettings;
    highScores: Record<string, RhythmHighScore>;
  };
  grammarGame: {
    stageRecords: Record<string, StageBestRecord>;
    totalClearedQuestions: number;
  };
  wordPuzzle: {
    stageRecords: Record<string, StageBestRecord>;
    bestEndlessScore: number;
    totalSolved: number;
  };
}
