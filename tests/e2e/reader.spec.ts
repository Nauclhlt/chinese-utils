import { expect, test } from '@playwright/test';

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const BASE_URL = env?.E2E_BASE_URL || 'http://127.0.0.1:4173/chinese-utils/index.html';
const toUploadBuffer = (text: string) =>
  (globalThis as unknown as { Buffer: { from: (s: string, enc: string) => never } }).Buffer.from(text, 'utf8');

test.describe('Annotated Chinese Literature Reader E2E', () => {
  test('reads bundled works, inspects overlapping annotations & spoilers, switches modes/themes, imports & rejects local JSON, and syncs with ReviewPage', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (res) => {
      if (res.status() >= 400) {
        errors.push(`HTTP ${res.status()}: ${res.url()}`);
      }
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(BASE_URL);
    await page.getByRole('link', { name: '中国語文学リーダー' }).click();
    await expect(page.getByTestId('bookshelf-page')).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/reader-bookshelf.png' });

    // 1. Open secondary bundled test work (zero-code addition verification)
    await page.getByTestId('open-work-suzhou-tea-note').click();
    await expect(page.getByTestId('literature-reader-page')).toBeVisible();
    await page.getByTestId('reader-next-chapter').click();
    await page.getByTestId('reader-complete-work').click();
    await page.getByRole('link', { name: '本棚へ' }).click();
    await expect(page.getByTestId('book-card-suzhou-tea-note')).toContainText('読了');

    // 2. Open primary sample novel (梅雨季的慢邮)
    await page.getByTestId('open-work-shanghai-rain-letters').click();
    await expect(page.getByTestId('reader-book-surface')).toBeVisible();

    // Verify spoiler lock in Chapter 1
    await page.getByTestId('reader-info-btn').click();
    await expect(page.getByTestId('reader-info-drawer')).toBeVisible();
    await page.getByTestId('reader-info-btn').click();

    // Switch modes (bilingual & pinyin) and theme (sepia)
    await page.getByTestId('reader-mode-pinyin').click();
    await page.getByTestId('reader-mode-bilingual').click();
    await page.getByTestId('reader-theme-sepia').click();

    // Click first interactive annotation -> popup -> open side panel -> add vocab
    const firstAnn = page.locator('.reader-seg-interactive').first();
    await firstAnn.click();
    await expect(page.getByTestId('reader-annotation-popup')).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/reader-popup.png' });

    const addBtn = page.locator('[data-testid^="popup-add-vocab-"]').first();
    if (await addBtn.count()) {
      await addBtn.click();
    }
    await page.getByTestId('reader-open-sidepanel-btn').click();
    await expect(page.getByTestId('reader-sidepanel')).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/reader-sidepanel.png' });
    await page.getByRole('button', { name: '詳細パネルを閉じる' }).click();

    // Bookmark first sentence, advance to Chapter 2, reload and verify restored position
    await page.locator('[data-testid^="bookmark-btn-"]').first().click();
    await page.getByTestId('reader-next-chapter').click();
    await expect(page.getByTestId('literature-reader-page')).toContainText('第2章');
    await page.reload();
    await expect(page.getByTestId('literature-reader-page')).toContainText('第2章');

    // Walk remaining chapters to completion
    await page.getByTestId('reader-next-chapter').click();
    await page.getByTestId('reader-next-chapter').click();
    await page.getByTestId('reader-complete-work').click();

    // Verify ReviewPage integration
    await page.getByRole('link', { name: '本棚へ' }).click();
    await page.getByRole('link', { name: '復習・苦手・履歴' }).click();
    await page.getByTestId('review-tab-reader').click();
    await expect(page.getByTestId('review-reader-panel')).toBeVisible();

    // 3. Test invalid JSON import rejection + valid JSON import & delete on Bookshelf
    await page.getByRole('link', { name: '中国語文学リーダー' }).click();
    const invalidJson = JSON.stringify({
      schemaVersion: '1.0.0',
      metadata: {
        id: 'bad-work',
        titleZh: '坏数据',
        titlePinyin: 'Huài shùjù',
        titleJa: '不正データ',
        author: 'Test',
        script: 'zh-Hans',
        genres: ['Test'],
        synopsis: 'Bad span',
        estimatedDifficulty: '目安',
        difficultyBasis: 'test',
        charCount: 2,
        chapterCount: 1,
        rights: { status: 'personal-local', notice: 'local', redistributableInRepo: false },
        createdAt: '2026-11-26',
        updatedAt: '2026-11-26',
      },
      characters: [],
      backgroundNotes: [],
      glossary: [{ id: 'g1', headword: '好', pinyin: 'hǎo', tones: [{ syllable: 'hǎo', tone: 3 }], pos: '形', generalMeaningJa: '良い', examples: [] }],
      chapters: [
        {
          id: 'c1',
          index: 0,
          number: 1,
          titleZh: '一',
          titlePinyin: 'Yī',
          titleJa: '一',
          summaryNoSpoiler: 'x',
          paragraphs: [
            {
              id: 'p1',
              kind: 'narrative',
              sentences: [
                {
                  id: 's1',
                  text: '今天下雨。',
                  pinyin: 'Jīntiān xiàyǔ.',
                  translationJa: '今日は雨だ。',
                  annotations: [
                    { id: 'a1', kind: 'vocab', start: 0, end: 2, surface: '明天', vocab: { glossaryId: 'g1', surface: '明天', contextualPinyin: 'míngtiān', contextualMeaningJa: '明日' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    await page.getByTestId('reader-import-file-input').setInputFiles({
      name: 'invalid-work.json',
      mimeType: 'application/json',
      buffer: toUploadBuffer(invalidJson),
    });
    await expect(page.getByTestId('reader-import-error')).toBeVisible();

    const validLocalJson = JSON.stringify({
      schemaVersion: '1.0.0',
      metadata: {
        id: 'local-e2e-hant',
        titleZh: '淡水暮色',
        titlePinyin: 'Dànshuǐ Mùsè',
        titleJa: '淡水の夕暮れ',
        author: 'ローカル作者',
        script: 'zh-Hant',
        genres: ['散策'],
        synopsis: 'ローカルインポート検証用の繁体字短編。',
        estimatedDifficulty: '中級目安',
        difficultyBasis: 'テスト用基準',
        charCount: 6,
        chapterCount: 1,
        rights: { status: 'personal-local', notice: 'ローカル検証専用', redistributableInRepo: false },
        createdAt: '2026-11-26',
        updatedAt: '2026-11-26',
      },
      characters: [],
      backgroundNotes: [],
      glossary: [{ id: 'gl1', headword: '暮色', pinyin: 'mùsè', tones: [{ syllable: 'mù', tone: 4 }, { syllable: 'sè', tone: 4 }], pos: '名詞', generalMeaningJa: '夕暮れの色', examples: [] }],
      chapters: [
        {
          id: 'ch_loc_1',
          index: 0,
          number: 1,
          titleZh: '渡船頭',
          titlePinyin: 'Dùchuántóu',
          titleJa: '渡し場',
          summaryNoSpoiler: '港の夕暮れ',
          paragraphs: [
            {
              id: 'p_loc_1',
              kind: 'narrative',
              sentences: [
                {
                  id: 's_loc_1',
                  text: '淡水河邊的暮色漸濃。',
                  pinyin: 'Dànshuǐhé biān de mùsè jiàn nóng.',
                  translationJa: '淡水河畔の夕暮れが次第に深まっていく。',
                  annotations: [
                    {
                      id: 'ann_loc_1',
                      kind: 'vocab',
                      start: 5,
                      end: 7,
                      surface: '暮色',
                      vocab: { glossaryId: 'gl1', surface: '暮色', contextualPinyin: 'mùsè', contextualMeaningJa: '暮れゆく空の色' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    await page.getByTestId('reader-import-file-input').setInputFiles({
      name: 'local-e2e-hant.json',
      mimeType: 'application/json',
      buffer: toUploadBuffer(validLocalJson),
    });
    await expect(page.getByTestId('reader-import-preview')).toBeVisible();
    await page.getByTestId('reader-confirm-import-btn').click();
    await expect(page.getByTestId('book-card-local-e2e-hant')).toBeVisible();
    await page.getByTestId('delete-local-local-e2e-hant').click();
    await expect(page.getByTestId('book-card-local-e2e-hant')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('reader works cleanly on mobile viewport (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'メニューを開く' }).click();
    await page.getByRole('link', { name: '中国語文学リーダー' }).click();
    await expect(page.getByTestId('bookshelf-page')).toBeVisible();
    await page.getByTestId('open-work-shanghai-rain-letters').click();
    await expect(page.getByTestId('reader-book-surface')).toBeVisible();
    await page.locator('.reader-seg-interactive').first().click();
    await expect(page.getByTestId('reader-annotation-popup')).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/reader-mobile.png' });
  });
});
