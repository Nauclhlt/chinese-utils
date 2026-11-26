export type RhythmDifficulty = 'easy' | 'normal' | 'hard';

export type RhythmLearnMode =
  | 'hanzi'
  | 'pinyin-hint'
  | 'audio'
  | 'multi-syllable'
  | 'weak-vocab'
  | 'practice';

export interface RhythmSong {
  id: string;
  title: string;
  titleZh: string;
  bpm: number;
  durationSec: number;
  themeColor: string;
  description: string;
  scaleNotes: number[]; // MIDI note numbers
  chordProgression: number[][];
  density: Record<RhythmDifficulty, number>; // beat interval (e.g. 2 = every 2 beats)
}

export interface RhythmNote {
  id: string;
  vocabId: string;
  hanzi: string;
  pinyinDisplay: string; // tone-marked for result, stripped for pinyin-hint
  pinyinNoTone: string;
  meaningJa: string;
  tones: (1 | 2 | 3 | 4 | 5)[];
  syllables: string[];
  targetTimeSec: number;
  sandhiNote: string | null;
}

export type RhythmJudgment = 'perfect' | 'great' | 'good' | 'tone-miss' | 'miss';
