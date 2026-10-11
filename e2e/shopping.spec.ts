import type { Page } from '@playwright/test';

import { expect, shot, test } from './fixtures.ts';

const aisle = (page: Page, name: string) => page.getByRole('region', { name });
const row = (page: Page, name: string) =>
  page.locator('label').filter({ has: page.getByText(name, { exact: true }) });
const item = (page: Page, name: string) => page.getByRole('checkbox', { name: new RegExp(name) });
const summary = (page: Page) => page.getByText(/^\d+ блюд.* · куплено \d+ из \d+$/);
const clearButton = (page: Page) => page.getByRole('button', { name: 'Очистить купленное' });
const sendButton = (page: Page) => page.getByRole('button', { name: 'Отправить список в чат' });

test.describe('shopping list', () => {
  test('grouped and summed list, marks, clearing and sending to a chat', async ({ page }) => {
    await page.goto('/?user=1002&mock_reset=1');

    // The cart on the main screen counts the rows still to buy.
    const cart = page.getByRole('link', { name: 'Список покупок: осталось купить 8' });
    await expect(cart).toBeVisible();
    const box = await cart.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await shot(page, '01-home-cart');
    await cart.click();
    await expect(page).toHaveURL(/\/shopping$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Покупки');
    await expect(summary(page)).toHaveText('2 блюда · куплено 2 из 10');

    // Aisles in the fixed order; only the non-empty ones.
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'Мясо и рыба',
      'Овощи и зелень',
      'Молочное',
      'Бакалея',
    ]);
    // The same product with the same unit is summed and lists every dish.
    await expect(row(page, 'Рис')).toContainText('300 г');
    await expect(row(page, 'Рис')).toContainText('Ломо сальтадо, Оякодон');
    await expect(row(page, 'Соевый соус')).toContainText('6 ст. л.');
    await expect(row(page, 'Соль')).toContainText('по вкусу');
    // Different products stay apart even if both are onions; rows go by name.
    await expect(aisle(page, 'Овощи и зелень').getByRole('checkbox')).toHaveCount(4);
    await expect(aisle(page, 'Овощи и зелень').locator('label')).toHaveText([
      /^Картофель/,
      /^Красный лук/,
      /^Репчатый лук/,
      /^Томаты/,
    ]);
    // Bought rows are struck through and keep their place.
    await expect(item(page, 'Томаты')).toBeChecked();
    await expect(row(page, 'Томаты').getByText('Томаты', { exact: true })).toHaveCSS(
      'text-decoration-line',
      'line-through',
    );
    await shot(page, '02-shopping-list');

    // A mark is saved and survives a reload.
    await item(page, 'Яйца').click();
    await expect(summary(page)).toHaveText('2 блюда · куплено 3 из 10');
    await page.reload();
    await expect(item(page, 'Яйца')).toBeChecked();
    await item(page, 'Яйца').click();
    await expect(summary(page)).toHaveText('2 блюда · куплено 2 из 10');
    await item(page, 'Яйца').click();
    await expect(summary(page)).toHaveText('2 блюда · куплено 3 из 10');

    // The list to a chat: the unbought rows only, through Telegram's share link.
    await sendButton(page).click();
    const shared = await page.evaluate(() => window.__tgMockParams?.web_app_open_tg_link);
    const pathFull = (shared as { path_full?: unknown } | undefined)?.path_full;
    if (typeof pathFull !== 'string') throw new Error('No share link opened');
    expect(pathFull).toMatch(/^\/share\/url\?/);
    const params = new URLSearchParams(pathFull.slice(pathFull.indexOf('?')));
    expect(params.get('url')).toBe('https://t.me/tma80_dev_bot/app?startapp=inv1002');
    const text = params.get('text') ?? '';
    expect(text.startsWith('Список покупок\n\nМясо и рыба\n• Говяжья вырезка — 400 г')).toBe(true);
    expect(text).toContain('Бакалея\n• Рис — 300 г\n• Соевый соус — 6 ст. л.\n• Соль — по вкусу');
    expect(text).not.toContain('Томаты');
    expect(text).not.toContain('Яйца');
    expect(text).not.toContain('Молочное');

    // «Очистить купленное» removes the bought rows; the button hides with nothing to clear.
    await clearButton(page).click();
    await expect(summary(page)).toHaveText('2 блюда · куплено 0 из 7');
    await expect(row(page, 'Томаты')).toHaveCount(0);
    await expect(aisle(page, 'Молочное')).toHaveCount(0);
    await expect(clearButton(page)).toHaveCount(0);
    await shot(page, '03-shopping-cleared');

    // Back to the main screen: the counter follows the list.
    await page.getByRole('button', { name: 'Назад (кнопка Telegram)' }).click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(
      page.getByRole('link', { name: 'Список покупок: осталось купить 7' }),
    ).toBeVisible();
  });

  test('items added on the dish card are summed with the list', async ({ page }) => {
    await page.goto('/dishes/pe-ceviche?user=1002&mock_reset=1');
    await page.getByRole('button', { name: 'В список покупок' }).click();
    await page.getByRole('link', { name: 'Открыть список' }).click();
    await expect(page).toHaveURL(/\/shopping$/);
    await expect(summary(page)).toHaveText('3 блюда · куплено 2 из 14');
    await expect(row(page, 'Красный лук')).toContainText('2 шт');
    await expect(row(page, 'Красный лук')).toContainText('Ломо сальтадо, Севиче');
    await expect(row(page, 'Соль')).toContainText('Ломо сальтадо, Севиче');
  });

  test('everything bought: sending is disabled', async ({ page }) => {
    await page.goto('/shopping?user=1002&mock_reset=1');
    for (const name of [
      'Говяжья вырезка',
      'Картофель',
      'Красный лук',
      'Репчатый лук',
      'Яйца',
      'Рис',
      'Соевый соус',
      'Соль',
    ]) {
      // A click, not `check()`: the mark lands in the store a microtask later (RTK Query's
      // optimistic update), after Playwright's immediate state check.
      await item(page, name).click();
      await expect(item(page, name)).toBeChecked();
    }
    await expect(summary(page)).toHaveText('2 блюда · куплено 10 из 10');
    await expect(sendButton(page)).toBeDisabled();
  });

  test('empty list', async ({ page }) => {
    await page.goto('/?user=1004&mock_reset=1');
    await page.getByRole('link', { name: 'Список покупок', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Список покупок пуст');
    await expect(sendButton(page)).toHaveCount(0);
    await shot(page, '04-shopping-empty');
    await page.getByRole('button', { name: 'Выбрать ужин' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('loading, then an error with «Повторить»', async ({ page }) => {
    await page.goto('/shopping?user=1002&mock_reset=1&mock_error=shopping_list&mock_delay=1500');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Покупки');
    await expect(page.getByRole('status').filter({ hasText: 'Загрузка…' })).toBeVisible();
    await shot(page, '05-shopping-loading');
    await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible();
    await shot(page, '06-shopping-error');
    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(summary(page)).toHaveText('2 блюда · куплено 2 из 10');
  });

  test('a failed mark is rolled back with a message', async ({ page }) => {
    await page.goto('/shopping?user=1002&mock_reset=1&mock_error=shopping_check');
    await item(page, 'Яйца').click();
    await expect(page.getByText('Не удалось сохранить отметку. Попробуйте ещё раз.')).toBeVisible();
    await expect(item(page, 'Яйца')).not.toBeChecked();
    await item(page, 'Яйца').click();
    await expect(item(page, 'Яйца')).toBeChecked();
    await expect(page.getByText('Не удалось сохранить отметку. Попробуйте ещё раз.')).toHaveCount(
      0,
    );
  });
});
