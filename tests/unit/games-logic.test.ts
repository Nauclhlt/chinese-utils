import { describe, expect, it } from 'vitest';
import { createDefaultGamesState, loadGamesState, saveGamesState } from '../../src/games/core/gameStorage';
import { RHYTHM_SONGS } from '../../src/games/data/rhythm/songs';
import { buildRhythmChart, evaluateRhythmHit, stripToneMarks } from '../../src/games/rhythm/ToneRhythmGamePage';
import { evaluateWordPuzzleAnswer } from '../../src/games/puzzle/WordOrderPuzzleGamePage';
import { vocabulary } from '../../src/data';
import { novelChapters, novelMeta } from '../../src/games/data';

describe('games logic and persistence', () => {
  it('saves and loads games state cleanly', () => {
    localStorage.clear();
    const st = createDefaultGamesState();
    st.novel.unlockedEndings = ['end_true'];
    st.wordPuzzle.bestEndlessScore = 1200;
    saveGamesState(st);

    const loaded = loadGamesState();
    expect(loaded.novel.unlockedEndings).toEqual(['end_true']);
    expect(loaded.wordPuzzle.bestEndlessScore).toBe(1200);
  });

  it('builds rhythm charts and evaluates timing vs tone accuracy', () => {
    const chart = buildRhythmChart(RHYTHM_SONGS[0], 'normal', 'hanzi', vocabulary.slice(0, 30), new Set());
    expect(chart.length).toBeGreaterThan(5);
    expect(stripToneMarks('nǐ hǎo')).toBe('ni hao');

    expect(evaluateRhythmHit(30, 3, 3)).toBe('perfect');
    expect(evaluateRhythmHit(-110, 2, 2)).toBe('great');
    expect(evaluateRhythmHit(190, 4, 4)).toBe('good');
    expect(evaluateRhythmHit(10, 1, 2)).toBe('tone-miss');
    expect(evaluateRhythmHit(260, 1, 1)).toBe('miss');
  });

  it('evaluates word puzzle conversion and word order separately with distractors', () => {
    const sampleQ = {
      id: 'WP-TEST',
      stageId: 'stage01',
      difficulty: 1 as const,
      grammarIds: ['G01-03'],
      lessonId: 'L01',
      japanesePrompt: '私は中国語を学びます。',
      chunks: [
        { id: 'c1', pinyinMarked: 'wǒ', pinyinPlain: 'wo', hanzi: '我' },
        { id: 'c2', pinyinMarked: 'xué', pinyinPlain: 'xue', hanzi: '学', acceptableHanzi: ['学习'] },
        { id: 'c3', pinyinMarked: 'Hànyǔ', pinyinPlain: 'Hanyu', hanzi: '汉语' },
        { id: 'd1', pinyinMarked: 'shì', pinyinPlain: 'shi', hanzi: '是', isDistractor: true },
      ],
      correctOrderIds: ['c1', 'c2', 'c3'],
      modelAnswer: '我学汉语。',
      acceptableAnswers: ['我学汉语。', '我学习汉语。'],
      fullPinyin: 'Wǒ xué Hànyǔ.',
      structureBreakdown: [],
      explanation: 'test',
    };

    const okRes = evaluateWordPuzzleAnswer(
      sampleQ,
      { c1: '我', c2: '学习', c3: '汉语' },
      ['c1', 'c2', 'c3']
    );
    expect(okRes.conversionOk).toBe(true);
    expect(okRes.orderOk).toBe(true);

    const wrongOrder = evaluateWordPuzzleAnswer(
      sampleQ,
      { c1: '我', c2: '学', c3: '汉语' },
      ['c3', 'c2', 'c1']
    );
    expect(wrongOrder.conversionOk).toBe(true);
    expect(wrongOrder.orderOk).toBe(false);
  });

  it('loads all 5 novel chapters and reaches all 3 endings', () => {
    expect(novelChapters).toHaveLength(5);
    expect(novelMeta.endings).toHaveLength(3);
    const unlocked = new Set<string>();
    for (const ch of novelChapters) {
      for (const ln of ch.lines) {
        if (ln.unlockEnding) unlocked.add(ln.unlockEnding);
      }
    }
    expect(unlocked.size).toBe(3);
  });
});
