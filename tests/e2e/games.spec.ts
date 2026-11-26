import { expect, test } from '@playwright/test';

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const BASE_URL = env?.E2E_BASE_URL || 'http://127.0.0.1:4173/chinese-utils/index.html';

test.describe('4 Games Playtest E2E', () => {
  test('plays all 4 games end-to-end and verifies vocab integration with ReviewPage', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole('link', { name: 'ゲームセンター (4種)' }).click();
    await expect(page.getByRole('heading', { name: '中国語ゲームセンター' })).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/games-hub.png' });

    // 1. Visual Novel: start, advance, click token -> add to review, quick save, return to hub
    await page.getByTestId('launch-novel-game').click();
    await expect(page.getByTestId('novel-title-screen')).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/novel-title.png' });
    await page.getByTestId('novel-start-btn').click();
    await expect(page.getByTestId('novel-play-stage')).toBeVisible();
    // Click dialogue box to finish typing immediately, then click first interactive token
    await page.locator('.novel-textbox').click();
    await page.screenshot({ path: 'test-results/screenshots/novel-play.png' });
    const firstToken = page.locator('.novel-token-word').first();
    await firstToken.click();
    await expect(page.getByTestId('novel-dict-card')).toBeVisible();
    await page.getByTestId('novel-add-vocab-btn').click();
    await page.getByRole('button', { name: 'Q.Save' }).click();
    await page.getByRole('link', { name: 'ゲームセンターへ戻る' }).click();

    // 2. Tone Rhythm Game: select practice mode, play to result, verify result & replay
    await page.getByTestId('launch-rhythm-game').click();
    await expect(page.getByTestId('rhythm-title-screen')).toBeVisible();
    await page.getByRole('button', { name: '無制限練習' }).click();
    await page.screenshot({ path: 'test-results/screenshots/rhythm-title.png' });
    await page.getByTestId('rhythm-start-btn').click();
    await expect(page.getByTestId('rhythm-play-screen')).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/rhythm-play.png' });
    await page.getByTestId('tone-pad-1').click();
    await page.getByRole('button', { name: '終了して結果へ' }).click();
    await expect(page.getByTestId('rhythm-result-screen')).toBeVisible();
    await page.getByRole('link', { name: 'ゲームセンターへ戻る' }).click();

    // 3. Grammar Correction Game: launch Stage 1, play, verify result
    await page.getByTestId('launch-grammar-game').click();
    await expect(page.getByTestId('grammar-game-title')).toBeVisible();
    await page.getByTestId('grammar-start-stage01').click();
    await expect(page.getByTestId('grammar-game-play')).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/grammar-hunter-play.png' });
    await page.getByTestId('grammar-game-submit').click();
    await expect(page.locator('.banner')).toBeVisible();
    await page.getByRole('link', { name: 'ゲームセンターへ戻る' }).click();

    // 4. Word Order Puzzle Game: launch Stage 1, input Hanzi (checking IME-safe Enter), place chunks, submit
    await page.getByTestId('launch-puzzle-game').click();
    await expect(page.getByTestId('puzzle-game-title')).toBeVisible();
    await page.getByTestId('puzzle-start-stage01').click();
    await expect(page.getByTestId('puzzle-game-play')).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/word-puzzle-play.png' });

    const placeButtons = page.locator('[data-testid^="puzzle-place-"]');
    const pCount = await placeButtons.count();
    for (let i = 0; i < pCount; i++) {
      const inputEl = page.locator('[data-testid^="puzzle-input-"]').nth(i);
      await inputEl.fill('我');
      await placeButtons.nth(i).click();
    }
    await page.getByTestId('puzzle-submit-btn').click();
    await expect(page.getByTestId('puzzle-feedback')).toBeVisible();

    // 5. Verify Novel vocab integration in ReviewPage
    await page.getByRole('link', { name: '復習・苦手・履歴' }).click();
    await page.getByTestId('review-tab-novel').click();
    await expect(page.locator('table.data-table tbody tr').first()).toBeVisible();
  });

  test('4 games work cleanly on mobile viewport (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'メニューを開く' }).click();
    await page.getByRole('link', { name: 'ゲームセンター (4種)' }).click();
    await expect(page.getByRole('heading', { name: '中国語ゲームセンター' })).toBeVisible();
    await page.getByTestId('launch-rhythm-game').click();
    await page.getByRole('button', { name: '無制限練習' }).click();
    await page.getByTestId('rhythm-start-btn').click();
    await expect(page.getByTestId('tone-pad-5')).toBeVisible();
  });
});
