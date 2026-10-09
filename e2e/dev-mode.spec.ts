import { expect, test } from '@playwright/test';

test.describe('dev mode', () => {
  test('?user= opens the app as the chosen test user', async ({ page }) => {
    await page.goto('/?user=1002');
    await expect(page.getByText('Привет, Борис!')).toBeVisible();

    await page.goto('/?user=1001');
    await expect(page.getByText('Привет, Аня!')).toBeVisible();
    await expect(page.getByText('Привет, Борис!')).toHaveCount(0);
  });

  test('the chosen user survives navigation without ?user=', async ({ page }) => {
    await page.goto('/?user=1003');
    await expect(page.getByText('Привет, Вера!')).toBeVisible();

    await page.goto('/');
    await expect(page.getByText('Привет, Вера!')).toBeVisible();
  });

  test('the app calls ready, expand and sets Telegram colours at startup', async ({ page }) => {
    await page.goto('/?user=1004');
    await expect(page.getByText('Привет, Глеб!')).toBeVisible();

    const calls = await page.evaluate(() => window.__tgMockCalls ?? []);
    expect(calls).toEqual(
      expect.arrayContaining([
        'web_app_ready',
        'web_app_expand',
        'web_app_set_header_color',
        'web_app_set_background_color',
      ]),
    );

    // Both colours come from the --color-bg design token.
    const params = await page.evaluate(() => window.__tgMockParams ?? {});
    expect(params.web_app_set_header_color).toEqual({ color: '#f3f5f7' });
    expect(params.web_app_set_background_color).toEqual({ color: '#f3f5f7' });
  });
});

test.describe('dev mode: mock API errors', () => {
  test('an error state retries with a loading state and then shows the user', async ({ page }) => {
    await page.goto('/?user=1002&mock_error=auth&mock_delay=500');
    await expect(page.getByRole('alert')).toHaveText('Не удалось загрузить данные.');

    const retry = page.getByRole('button', { name: 'Повторить' });
    const box = await retry.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);

    await retry.click();
    await expect(page.getByRole('status')).toContainText('Загрузка…');
    await expect(page.getByText('Привет, Борис!')).toBeVisible();
  });
});
