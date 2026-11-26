import { beforeEach, describe, expect, it } from 'vitest';
import { validateWork, countChineseChars } from '../../src/reader/core/validateWork';
import { buildTextSegments } from '../../src/reader/core/annotationSegments';
import {
  addBookmarkToWork,
  addReaderVocabToReview,
  createDefaultReaderState,
  loadReaderState,
  saveReaderState,
  upsertWorkProgress,
} from '../../src/reader/core/readerStorage';
import { bundledWorks } from '../../src/reader/data';
import type { InlineAnnotation, LiteratureWork } from '../../src/reader/types/work';

function createMinimalValidWork(overrides?: Partial<LiteratureWork>): LiteratureWork {
  return {
    schemaVersion: '1.0.0',
    metadata: {
      id: 'unit-test-work',
      titleZh: '微雨舊信',
      titlePinyin: 'Wēiyǔ Jiùxìn',
      titleJa: '小雨の古い手紙',
      author: 'テスト著者',
      script: 'zh-Hant',
      genres: ['文学'],
      synopsis: '繁体字の短いテスト作品。',
      estimatedDifficulty: '中級目安',
      difficultyBasis: 'テスト用サンプル基準',
      charCount: 10,
      chapterCount: 1,
      rights: {
        status: 'personal-local',
        notice: '単体テスト用',
        redistributableInRepo: false,
      },
      createdAt: '2026-11-26',
      updatedAt: '2026-11-26',
    },
    characters: [],
    backgroundNotes: [],
    glossary: [
      {
        id: 'g1',
        headword: '舊信',
        pinyin: 'jiùxìn',
        tones: [
          { syllable: 'jiù', tone: 4 },
          { syllable: 'xìn', tone: 4 },
        ],
        pos: '名詞',
        generalMeaningJa: '古い手紙',
        examples: [],
      },
    ],
    chapters: [
      {
        id: 'c1',
        index: 0,
        number: 1,
        titleZh: '雨聲',
        titlePinyin: 'Yǔshēng',
        titleJa: '雨音',
        summaryNoSpoiler: '冒頭',
        paragraphs: [
          {
            id: 'p1',
            kind: 'narrative',
            sentences: [
              {
                id: 's1',
                text: '我在舊書店裡翻出了一封舊信。',
                pinyin: 'Wǒ zài jiù shūdiàn lǐ fānchū le yì fēng jiùxìn.',
                translationJa: '古い本屋で一通の古い手紙を見つけ出した。',
                annotations: [
                  {
                    id: 'a_expr',
                    kind: 'expression',
                    start: '我在舊書店裡'.length,
                    end: '我在舊書店裡翻出了一封舊信'.length,
                    surface: '翻出了一封舊信',
                    expression: {
                      subtype: 'nuance',
                      subtypeLabelJa: '方向補語＋偶然',
                      meaningJa: '探し出す・ひょっこり見つけ出す',
                      nuanceNote: '結果・発見のニュアンス。',
                      factType: 'fact',
                    },
                  },
                  {
                    id: 'a_voc',
                    kind: 'vocab',
                    start: '我在舊書店裡翻出了一封'.length,
                    end: '我在舊書店裡翻出了一封舊信'.length,
                    surface: '舊信',
                    vocab: {
                      glossaryId: 'g1',
                      surface: '舊信',
                      contextualPinyin: 'jiùxìn',
                      contextualMeaningJa: '年月の経った手紙',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('Literature Reader Validation, Overlap Segmentation & Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('validates all bundled works with zero errors and accurate character counts', () => {
    expect(bundledWorks.length).toBeGreaterThanOrEqual(2);
    for (const work of bundledWorks) {
      const res = validateWork(work);
      expect(res.errors).toEqual([]);
      expect(res.valid).toBe(true);
      expect(res.stats.actualCharCount).toBeGreaterThan(200);
    }
    const primary = bundledWorks.find((w) => w.metadata.id === 'shanghai-rain-letters');
    expect(primary).toBeDefined();
    expect(primary!.chapters.length).toBeGreaterThanOrEqual(4);
    expect(countChineseChars(JSON.stringify(primary!.chapters.map((c) => c.paragraphs)))).toBeGreaterThanOrEqual(3000);
  });

  it('supports Traditional Chinese (zh-Hant) without altering original text', () => {
    const work = createMinimalValidWork();
    const res = validateWork(work);
    expect(res.valid).toBe(true);
    expect(work.chapters[0].paragraphs[0].sentences[0].text).toContain('舊書店裡');
  });

  it('rejects out-of-range annotation indices, mismatched surface, and dangerous scripts/paths', () => {
    const badRange = createMinimalValidWork();
    badRange.chapters[0].paragraphs[0].sentences[0].annotations[1].surface = '間違';
    expect(validateWork(badRange).valid).toBe(false);

    const malicious = createMinimalValidWork();
    malicious.metadata.coverImage = 'javascript:alert(1)';
    malicious.chapters[0].paragraphs[0].sentences[0].text = '测试<script>alert(1)</script>';
    const malRes = validateWork(malicious);
    expect(malRes.valid).toBe(false);
    expect(malRes.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('splits overlapping annotations cleanly and hides future-chapter spoiler annotations', () => {
    const sent = createMinimalValidWork().chapters[0].paragraphs[0].sentences[0];
    const spoilerAnn: InlineAnnotation = {
      id: 'a_spoiler',
      kind: 'background',
      start: 2,
      end: 5,
      surface: '舊書店',
      revealFromChapterIndex: 2,
      background: {
        backgroundNoteId: 'bg1',
        shortHintJa: '第3章ネタバレ',
      },
    };
    const allAnns = [...sent.annotations, spoilerAnn];

    const segsEarly = buildTextSegments(sent.text, allAnns, {
      showVocab: true,
      showGrammar: true,
      showExpression: true,
      showBackground: true,
      currentChapterIndex: 0,
      maxReachedChapterIndex: 0,
      allowSpoilers: false,
    });
    // Reconstructing segments yields exact original sentence text
    expect(segsEarly.map((s) => s.text).join('')).toBe(sent.text);
    // Spoiler annotation at index 2..5 must not appear while at chapter 0
    expect(segsEarly.flatMap((s) => s.annotations).some((a) => a.id === 'a_spoiler')).toBe(false);
    // Overlapping expression [6..14) and vocab [12..14) stack on '舊信'
    const lastSeg = segsEarly.find((s) => s.text === '舊信');
    expect(lastSeg?.annotations.map((a) => a.id)).toEqual(['a_voc', 'a_expr']);
  });

  it('persists reading progress, bookmarks, and review vocab across reloads', () => {
    let state = createDefaultReaderState();
    state = upsertWorkProgress(state, 'shanghai-rain-letters', 2, 's2_1', 4, false);
    state = addBookmarkToWork(state, 'shanghai-rain-letters', 2, 's2_1', '雨水顺着屋檐滴落');
    state = addReaderVocabToReview(state, {
      id: 'shanghai-rain-letters::g1',
      workId: 'shanghai-rain-letters',
      workTitleZh: '梅雨季的慢邮',
      glossaryId: 'g1',
      word: '慢递',
      pinyin: 'màndì',
      pos: '名詞',
      meaningJa: '未来日付配達サービス',
    });
    saveReaderState(state);

    const reloaded = loadReaderState();
    expect(reloaded.progressByWork['shanghai-rain-letters'].currentChapterIndex).toBe(2);
    expect(reloaded.progressByWork['shanghai-rain-letters'].bookmarks.length).toBe(1);
    expect(reloaded.vocabReview[0].word).toBe('慢递');
  });
});
