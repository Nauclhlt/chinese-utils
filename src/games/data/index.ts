import type { NovelChapterData, NovelMeta } from '../types/novel';
import type { GrammarCorrectionQuestion, GrammarStageMeta } from '../types/grammarGame';
import type { WordPuzzleQuestion, WordPuzzleStageMeta } from '../types/wordPuzzle';

import novelMetaRaw from './novel/meta.json';
import grammarStagesRaw from './grammar-correction/stages.json';
import puzzleStagesRaw from './word-puzzle/stages.json';

const novelChapterMods = import.meta.glob<{ default: NovelChapterData }>('./novel/ch*.json', {
  eager: true,
});
const grammarStageMods = import.meta.glob<{ default: GrammarCorrectionQuestion[] }>(
  './grammar-correction/stage*.json',
  { eager: true }
);
const puzzleStageMods = import.meta.glob<{ default: WordPuzzleQuestion[] }>(
  './word-puzzle/stage*.json',
  { eager: true }
);

export const novelMeta: NovelMeta = novelMetaRaw as NovelMeta;

export const novelChapters: NovelChapterData[] = Object.entries(novelChapterMods)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, mod]) => (mod.default ?? (mod as unknown as NovelChapterData)))
  .sort((a, b) => a.number - b.number);

export const grammarStages: GrammarStageMeta[] = [...(grammarStagesRaw as GrammarStageMeta[])].sort(
  (a, b) => a.number - b.number
);

export const grammarCorrectionQuestions: GrammarCorrectionQuestion[] = Object.entries(
  grammarStageMods
)
  .filter(([k]) => !k.endsWith('stages.json'))
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([, mod]) =>
    Array.isArray(mod.default) ? mod.default : (mod as unknown as GrammarCorrectionQuestion[])
  );

export const wordPuzzleStages: WordPuzzleStageMeta[] = [...(puzzleStagesRaw as WordPuzzleStageMeta[])].sort(
  (a, b) => a.number - b.number
);

export const wordPuzzleQuestions: WordPuzzleQuestion[] = Object.entries(puzzleStageMods)
  .filter(([k]) => !k.endsWith('stages.json'))
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([, mod]) =>
    Array.isArray(mod.default) ? mod.default : (mod as unknown as WordPuzzleQuestion[])
  );
