import type { Page } from '@playwright/test';

import { expect, shot, test } from './fixtures.ts';

/** Thursday evening in Moscow: the same daily suggestions on every run. */
const THURSDAY = new Date('2026-10-08T18:00:00+03:00');

const ingredients = (page: Page) => page.getByRole('region', { name: 'Ингредиенты' });
const ingredient = (page: Page, name: string) =>
  ingredients(page).getByRole('checkbox', { name: new RegExp(`^${name} `) });
const row = (page: Page, name: string) =>
  ingredients(page)
    .locator('label')
    .filter({ has: page.getByRole('checkbox', { name: new RegExp(`^${name} `) }) });
const servings = (page: Page) => page.getByRole('group', { name: 'Порции' });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(THURSDAY);
});

test.describe('dish card', () => {
  test('recalculates servings, marks «есть дома» and adds the rest to the shopping list', async ({
    page,
  }) => {
    await page.goto('/dishes/pe-ceviche?user=1002&mock_reset=1');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Севиче');
    await expect(page.getByText('Перу', { exact: true })).toBeVisible();
    await expect(page.getByText('Сырая рыба, маринованная в соке лайма')).toBeVisible();
    await expect(page.getByText('Интересный факт')).toBeVisible();
    await expect(page.getByText('45 мин')).toBeVisible();
    await expect(page.getByText('Вызов')).toBeVisible();

    // Борис cooks for two: 2 servings, the content amounts.
    await expect(servings(page)).toContainText('2порции');
    await expect(row(page, 'Филе белой рыбы')).toContainText('400 г');
    await expect(row(page, 'Лайм')).toContainText('4 шт');
    await expect(row(page, 'Соль')).toContainText('по вкусу');
    await shot(page, '01-card');

    // − / + keep a 44 × 44 touch target on 390 and 375 px wide screens.
    for (const width of [390, 375]) {
      await page.setViewportSize({ width, height: 844 });
      for (const name of ['Меньше порций', 'Больше порций']) {
        const box = await servings(page).getByRole('button', { name }).boundingBox();
        expect(box?.width, `${name} at ${String(width)} px`).toBeGreaterThanOrEqual(44);
        expect(box?.height, `${name} at ${String(width)} px`).toBeGreaterThanOrEqual(44);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });

    // + / − recalculate the amounts at once; «по вкусу» stays.
    await servings(page).getByRole('button', { name: 'Больше порций' }).click();
    await expect(servings(page)).toContainText('3порции');
    await expect(row(page, 'Филе белой рыбы')).toContainText('600 г');
    await expect(row(page, 'Лайм')).toContainText('6 шт');
    await expect(row(page, 'Соль')).toContainText('по вкусу');
    const fewer = servings(page).getByRole('button', { name: 'Меньше порций' });
    await fewer.click();
    await fewer.click();
    await expect(servings(page)).toContainText('1порция');
    await expect(row(page, 'Филе белой рыбы')).toContainText('200 г');
    await expect(row(page, 'Красный лук')).toContainText('0,5 шт');
    await expect(fewer).toBeDisabled();

    // «Есть дома» for two ingredients; the cart adds the other four.
    await ingredient(page, 'Соль').check();
    await ingredient(page, 'Кинза').check();
    const cart = page.getByRole('button', { name: 'В список покупок' });
    await cart.click();
    const status = page.getByRole('status');
    await expect(status).toContainText('Добавлено в список покупок: 4');
    await expect(status.getByRole('link', { name: 'Открыть список' })).toHaveAttribute(
      'href',
      '/shopping',
    );
    await ingredients(page).scrollIntoViewIfNeeded();
    await shot(page, '02-added');

    // Everything at home: nothing to buy, the cart is disabled.
    for (const name of ['Филе белой рыбы', 'Лайм', 'Красный лук', 'Чили']) {
      await ingredient(page, name).check();
    }
    await expect(
      page.getByRole('button', { name: 'Всё есть дома — покупать нечего' }),
    ).toBeDisabled();
    await expect(page.getByText(/Добавлено в список покупок/)).toHaveCount(0);

    // Opened directly: the Telegram «Назад» leads to the main screen, not out of the app.
    await page.getByRole('button', { name: 'Назад (кнопка Telegram)' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Что на ужин сегодня?');
  });

  test('opens from the main screen and goes back with the Telegram button', async ({ page }) => {
    await page.goto('/?user=1004&mock_reset=1');
    const big = page.getByRole('region', { name: 'Предложения на ужин' }).getByRole('link').first();
    const href = await big.getAttribute('href');
    await big.click();
    await expect(page).toHaveURL(href ?? '');
    // Дмитрий eats alone: 1 serving.
    await expect(servings(page)).toContainText('1порция');
    await expect(page.getByRole('button', { name: 'Начать готовить' })).toBeVisible();
    await servings(page).getByRole('button', { name: 'Больше порций' }).click();
    const first = ingredients(page).getByRole('checkbox').first();
    await first.check();

    await page.getByRole('button', { name: 'Назад (кнопка Telegram)' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Что на ужин сегодня?');

    // Servings and «есть дома» marks are kept while the app is open.
    await big.click();
    await expect(servings(page)).toContainText('2порции');
    await expect(first).toBeChecked();
  });

  test('a closed country opens the paywall instead of the recipe', async ({ page }) => {
    await page.goto('/?user=1003&mock_reset=1');
    const locked = page
      .getByRole('region', { name: 'Предложения на ужин' })
      .getByRole('link')
      .filter({ hasText: 'Откроется с подпиской' });
    const dishId = new URLSearchParams(
      ((await locked.getAttribute('href')) ?? '').split('?')[1],
    ).get('dish');
    expect(dishId).toBeTruthy();

    await page.goto(`/dishes/${dishId ?? ''}`);
    await expect(page).toHaveURL(`/paywall?dish=${dishId ?? ''}`);
    await expect(page.getByRole('heading', { name: 'Откроется с подпиской' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Ингредиенты' })).toHaveCount(0);
    await shot(page, '03-paywall-stub');

    // Opened directly: «Не сейчас» goes to the main screen, not out of the app.
    await page.getByRole('button', { name: 'Не сейчас' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Что на ужин сегодня?');
  });

  test('shows loading, an error with retry and «not found»', async ({ page }) => {
    await page.goto('/dishes/pe-ceviche?user=1002&mock_reset=1&mock_delay=800');
    await expect(page.getByRole('status').filter({ hasText: 'Загрузка…' })).toBeVisible();
    await shot(page, '04-loading');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Севиче');

    await page.goto('/dishes/pe-ceviche?user=1002&mock_error=dish');
    const retry = page.getByRole('button', { name: 'Повторить' });
    await expect(retry).toBeVisible();
    await shot(page, '05-error');
    await retry.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Севиче');

    await page.goto('/dishes/xx-nothing?user=1002');
    await expect(page.getByText('Блюдо не найдено')).toBeVisible();
    await page.getByRole('button', { name: 'На главную' }).click();
    await expect(page).toHaveURL('/');
  });

  test('a failed add to the shopping list says so and can be repeated', async ({ page }) => {
    await page.goto('/dishes/pe-ceviche?user=1002&mock_reset=1&mock_error=shopping');
    const cart = page.getByRole('button', { name: 'В список покупок' });
    await cart.click();
    await expect(page.getByRole('status')).toContainText('Не удалось добавить в список покупок');
    await shot(page, '06-add-error');
    await cart.click();
    await expect(page.getByRole('status')).toContainText('Добавлено в список покупок: 6');
  });
});
