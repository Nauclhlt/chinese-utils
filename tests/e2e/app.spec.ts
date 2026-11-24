import { expect, test } from '@playwright/test';

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const BASE_URL = env?.E2E_BASE_URL || 'http://127.0.0.1:4173/chinese-utils/index.html';

test.describe('Chinese Learning App E2E', () => {
  test('renders dashboard, configures scope, navigates lessons, grammar, vocab, flashcards, pinyin, exercises, composition, exam, export/import, and persists on reload', async ({
    page,
  }) => {
    // 1. Open under GitHub Pages subpath simulation
    await page.goto(BASE_URL);
    await expect(page.getByRole('heading', { name: '学習ダッシュボード' })).toBeVisible();

    // Configure scope to Lesson 14 via topbar modal
    await page.getByTestId('scope-trigger').click();
    const dialog = page.getByRole('dialog', { name: '学習範囲の設定' });
    await dialog.getByRole('button', { name: '第14課まで' }).click();
    await dialog.getByRole('button', { name: 'この範囲で保存' }).click();
    await expect(page.getByTestId('scope-trigger')).toContainText('第1課〜第14課');

    // 2. Lesson learning
    await page.getByRole('link', { name: '課別学習 (全22課)' }).click();
    await expect(page.getByRole('heading', { name: '課別学習（全22課）' })).toBeVisible();
    await page.getByRole('link', { name: 'この課を学習する' }).first().click();
    await expect(page.getByRole('heading', { name: /第1課/ })).toBeVisible();
    await page.getByRole('button', { name: '学習完了にする' }).click();
    await expect(page.getByRole('button', { name: '学習済み' })).toBeVisible();

    // 3. Grammar dictionary & search
    await page.getByRole('link', { name: '文法辞典' }).click();
    await expect(page.getByRole('heading', { name: '文法辞典・例文検索' })).toBeVisible();
    await page.getByPlaceholder('文法名・中国語・ピンイン・日本語訳を検索...').fill('是');
    await expect(page.locator('a[href*="/grammar/G01-02"]').first()).toBeVisible();
    await page.locator('a[href*="/grammar/G01-02"]').first().click();
    await expect(page.getByText('語順の説明:')).toBeVisible();

    // 4. Vocabulary search & column toggle
    await page.getByRole('link', { name: '単語帳' }).click();
    await expect(page.getByRole('heading', { name: '単語帳・語彙データベース' })).toBeVisible();
    await page.getByPlaceholder('簡体字・ピンイン・日本語訳を検索...').fill('你');
    await expect(page.locator('table.data-table tbody tr').first()).toBeVisible();
    await page.getByRole('button', { name: /ピンインを隠す/ }).click();
    await expect(page.locator('table.data-table tbody tr').first()).toContainText('••••');
    await page.getByRole('button', { name: /ピンインを隠す/ }).click();

    // 5. Flashcards (including random order toggle)
    await page.getByRole('link', { name: 'フラッシュカード' }).click();
    await expect(page.getByRole('heading', { name: /フラッシュカード/ })).toBeVisible();
    await page.getByTestId('random-order-toggle').click();
    await expect(page.getByTestId('reshuffle-btn')).toBeVisible();
    await page.getByRole('button', { name: /答えを見る/ }).click();
    await page.getByRole('button', { name: /3\. 覚えた/ }).click();

    // 6. Pinyin input (scope selection, random order, and numbered pinyin equivalence)
    await page.getByRole('link', { name: 'ピンイン・声調練習' }).click();
    await expect(page.getByRole('heading', { name: 'ピンイン・声調練習' })).toBeVisible();
    await page.getByLabel('ピンイン出題範囲').selectOption('single');
    await page.getByLabel('対象課を選択').selectOption('L02');
    await expect(page.getByTestId('pinyin-pool-count')).toContainText('22');
    await expect(page.getByTestId('pinyin-drill-card')).toContainText('L02');
    await page.getByTestId('random-order-toggle').click();
    await expect(page.getByTestId('reshuffle-btn')).toBeVisible();
    await page.getByTestId('reshuffle-btn').click();
    const hanziText = await page.getByTestId('pinyin-drill-card').locator('.zh-xl').innerText();
    expect(hanziText.length).toBeGreaterThan(0);
    await page.getByPlaceholder(/ni3 hao3/).fill('ni3');
    await page.getByRole('button', { name: '判定する' }).click();
    await expect(page.getByTestId('pinyin-drill-card').locator('.banner')).toBeVisible();

    // 7. Grammar exercises (multiple choice, word-order & random order toggle)
    await page.getByRole('link', { name: '文法練習問題' }).click();
    await expect(page.getByRole('heading', { name: '文法練習問題' })).toBeVisible();
    await page.getByTestId('random-order-toggle').click();
    await expect(page.getByTestId('reshuffle-btn')).toBeVisible();
    await page.getByLabel('問題形式').selectOption('multiple-choice');
    const firstChoice = page.locator('.choice-btn').first();
    await firstChoice.click();
    await page.getByRole('button', { name: '解答を確認する' }).click();
    await expect(page.locator('[data-testid^="exercise-card-"] .banner')).toBeVisible();

    await page.getByLabel('問題形式').selectOption('word-order');
    const bankTokens = page.locator('div.row-wrap > .token-chip');
    const tokCount = await bankTokens.count();
    for (let i = 0; i < tokCount; i++) {
      await bankTokens.nth(i).click();
    }
    await page.getByRole('button', { name: '解答を確認する' }).click();
    await expect(page.locator('[data-testid^="exercise-card-"] .banner')).toBeVisible();

    // 8. Chinese composition practice, random order & model comparison
    await page.getByRole('link', { name: '中国語作文練習' }).click();
    await expect(page.getByRole('heading', { name: '中国語作文練習' })).toBeVisible();
    await page.getByTestId('random-order-toggle').click();
    await expect(page.getByTestId('reshuffle-btn')).toBeVisible();
    await page.locator('#comp-input').fill('我是学生。');
    await page.getByRole('button', { name: '模範解答と比較・保存する' }).click();
    await expect(page.getByText('模範解答', { exact: true })).toBeVisible();
    await expect(page.getByText('語順・文法構造の色分け解説')).toBeVisible();

    // 9. Comprehensive Exam
    await page.getByRole('link', { name: '総合テスト・模試' }).click();
    await page.getByLabel('問題数').selectOption('5');
    await page.getByRole('button', { name: 'テストを開始する' }).click();
    await page.getByRole('button', { name: '採点して終了する' }).click();
    await expect(page.getByTestId('exam-result')).toBeVisible();

    // 10. Reload persistence check (HashRouter + localStorage)
    await page.reload();
    await expect(page.getByTestId('scope-trigger')).toContainText('第1課〜第14課');

    // 11. Settings export / import flow
    await page.getByRole('link', { name: '設定・データ管理' }).click();
    await expect(page.getByRole('heading', { name: '設定・データ管理' })).toBeVisible();
    await page.locator('#import-json-textarea').fill('{"version":1,"scope":{"mode":"upTo","upToLesson":8,"selectedLessons":[]}}');
    await page.getByTestId('import-json-trigger').click();
    await expect(page.getByTestId('import-confirm-box')).toBeVisible();
    await page.getByTestId('import-confirm-btn').click();
    await expect(page.getByTestId('scope-trigger')).toContainText('第1課〜第8課');
  });

  test('supports mobile viewport navigation cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL);
    await expect(page.getByRole('heading', { name: '学習ダッシュボード' })).toBeVisible();
    await page.getByRole('button', { name: 'メニューを開く' }).click();
    await page.getByRole('link', { name: '単語帳' }).click();
    await expect(page.getByRole('heading', { name: '単語帳・語彙データベース' })).toBeVisible();
  });
});
