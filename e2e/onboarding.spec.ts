import type { Page } from '@playwright/test';

import { expect, test } from './fixtures.ts';

const question = (page: Page) => page.getByRole('heading', { level: 1 });
const next = (page: Page) => page.getByRole('button', { name: 'Дальше' });
/** Stand-in of the Telegram BackButton drawn by the mock Telegram environment. */
const telegramBack = (page: Page) => page.getByRole('button', { name: 'Назад (кнопка Telegram)' });

async function answerFirstTwo(page: Page) {
  await expect(question(page)).toHaveText('Кто ест за вашим столом?');
  await expect(next(page)).toBeDisabled();
  await page.getByText('Мы вдвоём').click();
  await expect(page.getByRole('radio', { name: /Мы вдвоём/ })).toBeChecked();
  await next(page).click();

  await expect(question(page)).toHaveText('Сколько времени на ужин в будни?');
  await expect(next(page)).toBeDisabled();
  await page.getByText('30 минут').click();
  await next(page).click();
  await expect(question(page)).toHaveText('Что вы не едите?');
}

test.describe('onboarding', () => {
  test('a newbie answers 3 questions, lands on the main screen and is not asked again', async ({
    page,
  }) => {
    await page.goto('/?user=1001&mock_reset=1');
    await expect(page).toHaveURL(/\/onboarding$/);
    const progress = page.getByRole('progressbar', { name: 'Вопросы онбординга' });
    await expect(progress).toHaveAttribute('aria-valuenow', '1');
    await expect(page.getByText('Вопрос 1 из 3')).toBeVisible();

    // Dark screen: the Telegram header and background are navy while the onboarding is shown.
    const params = () => page.evaluate(() => window.__tgMockParams ?? {});
    expect((await params()).web_app_set_header_color).toEqual({ color: '#14213d' });

    // Every answer is a 44 × 44+ touch target.
    const card = await page.getByText('Я один').locator('xpath=ancestor::label').boundingBox();
    expect(card?.height).toBeGreaterThanOrEqual(44);

    await answerFirstTwo(page);
    await expect(progress).toHaveAttribute('aria-valuenow', '3');

    // Nothing is required on step 3; meat implies pork.
    await expect(next(page)).toBeEnabled();
    await page.getByText('Мясо', { exact: true }).click();
    const pork = page.getByRole('checkbox', { name: /Свинина/ });
    await expect(pork).toBeChecked();
    await expect(pork).toBeDisabled();

    const request = page.waitForRequest(
      (req) => req.url().endsWith('/api/me') && req.method() === 'PATCH',
    );
    await next(page).click();
    const body: unknown = (await request).postDataJSON();
    expect(body).toEqual({
      household: 'couple',
      weekdayMinutes: 30,
      exclusions: ['meat'],
      timezone: expect.any(String),
    });

    await expect(page.getByText('Привет, Аня!')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    expect((await params()).web_app_set_header_color).toEqual({ color: '#f3f5f7' });

    // Reopening the mini app in the same tab: the mock backend remembers the answers.
    await page.goto('/?user=1001');
    await expect(page.getByText('Привет, Аня!')).toBeVisible();
    await page.goto('/onboarding');
    await expect(page.getByText('Привет, Аня!')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('the Telegram BackButton returns to the previous question with answers kept', async ({
    page,
  }) => {
    await page.goto('/?user=1001&mock_reset=1');
    await expect(question(page)).toHaveText('Кто ест за вашим столом?');
    await expect(telegramBack(page)).toHaveCount(0);

    await answerFirstTwo(page);
    // The mock Telegram header button is first in the DOM (first Tab stop) and above the content.
    await expect(page.locator('body > :first-child')).toHaveAttribute(
      'aria-label',
      'Назад (кнопка Telegram)',
    );
    const backBox = await telegramBack(page).boundingBox();
    const barBox = await page.getByRole('progressbar').boundingBox();
    expect((backBox?.y ?? 0) + (backBox?.height ?? 0)).toBeLessThanOrEqual(barBox?.y ?? 0);
    await telegramBack(page).click();
    await expect(question(page)).toHaveText('Сколько времени на ужин в будни?');
    await expect(page.getByRole('radio', { name: /30 минут/ })).toBeChecked();

    await telegramBack(page).click();
    await expect(question(page)).toHaveText('Кто ест за вашим столом?');
    await expect(page.getByRole('radio', { name: /Мы вдвоём/ })).toBeChecked();
    await expect(telegramBack(page)).toHaveCount(0);
  });

  test('without the Telegram BackButton (old client) the screen draws its own «Назад»', async ({
    page,
  }) => {
    await page.goto('/?user=1001&mock_reset=1&mock_tg_version=6.0');
    await expect(question(page)).toHaveText('Кто ест за вашим столом?');
    const back = page.getByRole('button', { name: 'Назад', exact: true });
    await expect(back).toHaveCount(0);

    await answerFirstTwo(page);
    await expect(telegramBack(page)).toHaveCount(0);
    const box = await back.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);

    await back.click();
    await expect(question(page)).toHaveText('Сколько времени на ужин в будни?');
    await expect(page.getByRole('radio', { name: /30 минут/ })).toBeChecked();
    await back.click();
    await expect(question(page)).toHaveText('Кто ест за вашим столом?');
    await expect(back).toHaveCount(0);
  });

  test('a screen chunk that fails to load shows «Повторить» and loads on retry', async ({
    page,
  }) => {
    await page.goto('/?user=1001&mock_reset=1&mock_error=chunk');
    await expect(page.getByRole('alert')).toHaveText('Не удалось открыть экран.');
    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(question(page)).toHaveText('Кто ест за вашим столом?');
  });

  test('if the retried chunk fails too, «Повторить» reloads the page and the screen opens', async ({
    page,
  }) => {
    // `chunk:always` fails the retry as well, as engines that cache a failed `import()` do. The
    // redirect to /onboarding drops the mock parameters, so the reloaded page loads the chunk.
    await page.goto('/?user=1001&mock_reset=1&mock_error=chunk:always');
    await expect(page.getByRole('alert')).toHaveText('Не удалось открыть экран.');
    const reloaded = page.waitForEvent('load');
    await page.getByRole('button', { name: 'Повторить' }).click();
    await reloaded;
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(question(page)).toHaveText('Кто ест за вашим столом?');
  });

  test('a failed save shows an error, keeps the answers and succeeds on retry', async ({
    page,
  }) => {
    await page.goto('/?user=1001&mock_reset=1&mock_error=me&mock_delay=400');
    await answerFirstTwo(page);
    await page.getByText('Глютен', { exact: true }).click();

    await next(page).click();
    const saving = page.getByRole('button', { name: 'Сохраняем…' });
    await expect(saving).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('alert')).toContainText('Не удалось сохранить ответы.');
    await expect(page.getByRole('checkbox', { name: /Глютен/ })).toBeChecked();

    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByText('Привет, Аня!')).toBeVisible();
  });

  test('an onboarded user goes straight to the main screen', async ({ page }) => {
    await page.goto('/?user=1002');
    await expect(page.getByText('Привет, Борис!')).toBeVisible();
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Привет, Борис!')).toBeVisible();
  });
});
