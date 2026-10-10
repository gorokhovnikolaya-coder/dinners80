import type { Page } from '@playwright/test';

import { expect, shot, test } from './fixtures.ts';

/** Thursday evening in Moscow: weekday mode by default, the same daily order on every run. */
const THURSDAY = new Date('2026-10-08T18:00:00+03:00');

const suggestions = (page: Page) => page.getByRole('region', { name: 'Предложения на ужин' });
const cards = (page: Page) => suggestions(page).getByRole('link');
const mode = (page: Page, name: RegExp) =>
  page.getByRole('group', { name: 'Подборка' }).getByRole('button', { name });
const cardTitles = async (page: Page) =>
  (await cards(page).allInnerTexts()).map((text) => text.replace(/\s+/g, ' '));

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(THURSDAY);
});

test.describe('dinner today', () => {
  test('shows 3 suggestions, switches weekdays/weekends and pages round', async ({ page }) => {
    await page.goto('/?user=1002&mock_reset=1');

    await expect(page.getByText('Четверг, 8 октября')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Что на ужин сегодня?');
    await expect(
      page.getByRole('link', { name: 'Пройдено стран: 8 из 12. Открыть карту' }),
    ).toHaveAttribute('href', '/map');
    await expect(page.getByRole('link', { name: 'Профиль: Борис' })).toHaveAttribute(
      'href',
      '/profile',
    );
    await expect(page.getByRole('navigation', { name: 'Разделы' })).toBeVisible();

    // Weekdays by default on Thursday, with the user's time; 3 cards, each opens its dish.
    await expect(mode(page, /Будни · до 30 мин/)).toHaveAttribute('aria-pressed', 'true');
    await expect(cards(page)).toHaveCount(3);
    for (const href of await cards(page).evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')),
    )) {
      expect(href).toMatch(/^\/dishes\/[a-z]+-[a-z-]+$/);
    }
    const weekday = await cardTitles(page);
    for (const text of weekday) expect(text).toMatch(/(\d+) мин/);
    await shot(page, '01-weekday');

    // «Показать другие» shows the next 3 and comes back round to the first page.
    const more = page.getByRole('button', { name: 'Показать другие' });
    const seen = [weekday.join('|')];
    for (let i = 0; i < 6; i += 1) {
      await more.click();
      await expect.poll(async () => (await cardTitles(page)).join('|')).not.toBe(seen.at(-1));
      const current = (await cardTitles(page)).join('|');
      if (current === seen[0]) break;
      seen.push(current);
      if (i === 0) await shot(page, '02-show-more');
    }
    expect(seen.length).toBeGreaterThan(1);
    await expect.poll(async () => (await cardTitles(page)).join('|')).toBe(seen[0]);

    // Weekends: weekend and challenge dishes.
    await mode(page, /Выходные/).click();
    await expect(mode(page, /Выходные/)).toHaveAttribute('aria-pressed', 'true');
    await expect(cards(page)).toHaveCount(3);
    await expect(suggestions(page)).toContainText(/Выходные|Вызов/);
    await shot(page, '03-weekend');

    // The tab bar navigates in the app (no page reload).
    await page
      .getByRole('navigation', { name: 'Разделы' })
      .getByRole('link', { name: 'Ужин' })
      .click();
    await expect(mode(page, /Выходные/)).toHaveAttribute('aria-pressed', 'true');
  });

  test('a free user with 10 countries sees 2 open dishes and a locked one', async ({ page }) => {
    await page.goto('/?user=1003&mock_reset=1');
    await expect(cards(page)).toHaveCount(3);
    const locked = cards(page).nth(2);
    await expect(locked).toContainText('Откроется с подпиской');
    await expect(locked).toHaveAttribute('href', /^\/paywall\?dish=/);
    await expect(cards(page).nth(0)).toHaveAttribute('href', /^\/dishes\//);
    await expect(cards(page).nth(0)).not.toContainText('Новая страна');
    await shot(page, '04-locked');
  });

  test('loading and error states, retry', async ({ page }) => {
    await page.goto('/?user=1002&mock_reset=1&mock_error=home&mock_delay=600');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Загрузка…');
    await shot(page, '05-loading');

    await expect(page.getByRole('alert')).toHaveText('Не удалось загрузить данные.');
    await shot(page, '06-error');
    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(cards(page)).toHaveCount(3);
  });

  test('empty state when the exclusions leave nothing', async ({ page }) => {
    // Дина (1005): no meat, gluten or spicy, and own words «сыр», «рыб» — no weekday dish left.
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'tma80:mock-db',
        JSON.stringify({
          1005: {
            patch: { exclusions: ['meat', 'spicy', 'gluten'], customExclusions: ['сыр', 'рыб'] },
            onboarded: true,
          },
        }),
      );
    });
    await page.goto('/?user=1005');
    await expect(page.getByText('Под ваши ограничения блюд не нашлось')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Показать другие' })).toHaveCount(0);
    await shot(page, '07-empty');
    await page.getByRole('button', { name: 'Изменить исключения' }).click();
    // The profile (task 13) does not exist yet: the router sends unknown paths home.
    await expect(page).toHaveURL(/\/$/);
  });
});
