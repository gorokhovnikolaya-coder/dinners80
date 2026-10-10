import type { Page } from '@playwright/test';

import { expect, shot, test } from './fixtures.ts';

/** Thursday evening in Moscow: fixture cooks are dated relative to it. */
const THURSDAY = new Date('2026-10-08T18:00:00+03:00');

const telegramBack = (page: Page) => page.getByRole('button', { name: 'Назад (кнопка Telegram)' });
const continent = (page: Page, name: string) => page.getByRole('region', { name });
const dishes = (page: Page) => page.getByRole('region', { name: 'Блюда страны' }).getByRole('link');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(THURSDAY);
});

test.describe('map and passport', () => {
  test('shows the counters and continents, opens a country and its dish', async ({ page }) => {
    await page.goto('/?user=1002&mock_reset=1');
    await page
      .getByRole('navigation', { name: 'Разделы' })
      .getByRole('link', { name: 'Карта' })
      .click();
    await expect(page).toHaveURL(/\/map$/);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Мой паспорт');
    await expect(page.getByText('10 блюд')).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Пройдено стран' })).toHaveAttribute(
      'aria-valuetext',
      '8 из 12 стран',
    );
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Европа', 'Азия', 'Америка']);
    await expect(continent(page, 'Европа')).toContainText('4 из 4');
    await expect(continent(page, 'Азия')).toContainText('1 из 4');
    await expect(continent(page, 'Америка')).toContainText('3 из 4');
    await expect(continent(page, 'Азия').getByRole('link')).toHaveCount(4);
    await expect(page.getByRole('link', { name: 'Китай: не пройдена' })).toBeVisible();
    await shot(page, '01-map');

    // A passed country: the first stamp date and «Приготовлено» on the cooked dish.
    await page.getByRole('link', { name: 'Япония: пройдена' }).click();
    await expect(page).toHaveURL(/\/map\/countries\/jp$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Япония');
    await expect(page.getByText('Азия', { exact: true })).toBeVisible();
    await expect(page.getByText('В паспорте с 23 сентября')).toBeVisible();
    await expect(dishes(page)).toHaveCount(3);
    await expect(dishes(page).filter({ hasText: 'Приготовлено' })).toHaveCount(1);
    await expect(dishes(page).filter({ hasText: 'Приготовлено' })).toHaveAttribute(
      'href',
      '/dishes/jp-oyakodon',
    );
    await shot(page, '02-country-passed');

    // A dish opens its card; «Назад» goes back to the country, then to the map.
    const other = dishes(page).filter({ hasNotText: 'Приготовлено' }).first();
    const href = await other.getAttribute('href');
    expect(href).toMatch(/^\/dishes\/jp-/);
    await other.click();
    await expect(page).toHaveURL(href ?? '');
    await telegramBack(page).click();
    await expect(page).toHaveURL(/\/map\/countries\/jp$/);
    await telegramBack(page).click();
    await expect(page).toHaveURL(/\/map$/);

    // A country not passed yet.
    await page.getByRole('link', { name: 'Китай: не пройдена' }).click();
    await expect(page.getByText('Ещё не пройдена')).toBeVisible();
    await expect(dishes(page).filter({ hasText: 'Приготовлено' })).toHaveCount(0);
    await shot(page, '03-country-not-passed');
  });

  test('a free user with 10 countries: closed countries with a lock lead to the paywall', async ({
    page,
  }) => {
    await page.goto('/map?user=1003&mock_reset=1');
    await expect(page.getByRole('progressbar', { name: 'Пройдено стран' })).toHaveAttribute(
      'aria-valuetext',
      '10 из 12 стран',
    );
    await expect(page.getByRole('link', { name: /: откроется с подпиской$/ })).toHaveCount(2);
    await shot(page, '04-map-locked');

    await page.getByRole('link', { name: 'Таиланд: откроется с подпиской' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Таиланд');
    await expect(dishes(page)).toHaveCount(3);
    for (const link of await dishes(page).all()) {
      await expect(link).toContainText('Откроется с подпиской');
      await expect(link).toHaveAttribute('href', /^\/paywall\?dish=th-/);
    }
    await shot(page, '05-country-locked');

    await dishes(page).first().click();
    await expect(page).toHaveURL(/\/paywall\?dish=th-/);
  });

  test('a subscriber sees no locks', async ({ page }) => {
    await page.goto('/map?user=1004&mock_reset=1');
    await expect(page.getByRole('progressbar', { name: 'Пройдено стран' })).toBeVisible();
    await expect(page.getByRole('link', { name: /: откроется с подпиской$/ })).toHaveCount(0);
  });

  test('loading, error with retry, unknown country', async ({ page }) => {
    await page.goto('/map?user=1002&mock_reset=1&mock_delay=1500');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Мой паспорт');
    await expect(page.getByRole('status').filter({ hasText: 'Загрузка…' })).toBeVisible();
    await shot(page, '06-loading');

    await page.goto('/map?user=1002&mock_error=map');
    await expect(page.getByRole('alert')).toHaveText('Не удалось загрузить данные.');
    await shot(page, '07-error');
    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Мой паспорт');
    await expect(page.getByRole('progressbar', { name: 'Пройдено стран' })).toBeVisible();

    await page.goto('/map/countries/xx?user=1002');
    await expect(page.getByRole('status')).toHaveText('Страна не найдена');
    await page.getByRole('button', { name: 'К карте' }).click();
    await expect(page).toHaveURL(/\/map$/);
  });
});
