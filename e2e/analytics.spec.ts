import type { Page } from '@playwright/test';

import { expect, test } from './fixtures.ts';

/** Thursday evening in Moscow: the same suggestions on every run. */
const THURSDAY = new Date('2026-10-08T18:00:00+03:00');

/** The `events` table of the mock backend. */
const storedEvents = (page: Page) => page.evaluate(() => window.tma80MockEvents?.() ?? []);
const names = async (page: Page) => (await storedEvents(page)).map((event) => event.name);
const eventNamed = async (page: Page, name: string) =>
  (await storedEvents(page)).filter((event) => event.name === name).map((event) => event.props);
const cards = (page: Page) =>
  page.getByRole('region', { name: 'Предложения на ужин' }).getByRole('link');

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: THURSDAY });
});

test.describe('analytics events', () => {
  test('the main scenario of a newbie by an invitation lands in the events table', async ({
    page,
  }) => {
    await page.goto('/?user=1001&mock_reset=1&startapp=inv1002');
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByText('Мы вдвоём').click();
    await page.getByRole('button', { name: 'Дальше' }).click();
    await page.getByText('30 минут').click();
    await page.getByRole('button', { name: 'Дальше' }).click();
    await page.getByRole('button', { name: 'Дальше' }).click();
    await expect(cards(page)).toHaveCount(3);

    await cards(page).first().click();
    const dishId = /\/dishes\/([^/?]+)/.exec(page.url())?.[1] ?? '';
    await page.getByRole('button', { name: 'В список покупок' }).click();
    await expect(page.getByText(/добавлен/i)).toBeVisible();

    await page.getByRole('button', { name: 'Начать готовить' }).click();
    const finish = page.getByRole('button', { name: 'Готово!' });
    while (!(await finish.isVisible())) {
      await page.getByRole('button', { name: 'Следующий шаг' }).click();
    }
    await finish.click();
    await page.getByRole('button', { name: 'Без фото' }).click();
    await page.getByRole('button', { name: 'Поделиться карточкой' }).click();
    await page.getByRole('button', { name: 'Отправить в чат' }).click();

    // The batches go a few seconds after the first event of each.
    await expect
      .poll(() => names(page), { timeout: 15_000 })
      .toEqual([
        'app_open',
        'onboarding_done',
        'suggestions_shown',
        'dish_opened',
        'shopping_added',
        'cook_started',
        'cook_finished',
        'share_clicked',
      ]);
    const events = await storedEvents(page);
    const props = Object.fromEntries(events.map((event) => [event.name, event.props]));
    expect(props).toMatchObject({
      app_open: { source: 'invite' },
      onboarding_done: { household: 'couple', weekday_minutes: 30, exclusions: [] },
      suggestions_shown: { mode: 'weekday', page: 0 },
      dish_opened: { dish_id: dishId, position: 1, from: 'suggestions' },
      shopping_added: { dish_id: dishId },
      cook_started: { dish_id: dishId, servings: 2 },
      cook_finished: { dish_id: dishId, new_country: true, has_photo: false },
      share_clicked: { channel: 'chat' },
    });
    expect(props.suggestions_shown?.dish_ids).toHaveLength(3);
  });

  test('the reminder launch, the locked card and another page of suggestions', async ({ page }) => {
    await page.goto('/?user=1003&mock_reset=1&from=reminder');
    await expect(cards(page)).toHaveCount(3);
    await cards(page).nth(2).click();
    await expect(page).toHaveURL(/\/paywall\?dish=/);
    await expect(page.getByRole('button', { name: 'Продолжить путешествие' })).toBeVisible();
    // «Показать другие» on the way back gives a new set of suggestions.
    await page.goBack();
    await page.getByRole('button', { name: 'Показать другие' }).click();

    await expect
      .poll(() => eventNamed(page, 'app_open'), { timeout: 15_000 })
      .toEqual([{ source: 'reminder' }]);
    await expect
      .poll(() => eventNamed(page, 'paywall_shown'), { timeout: 15_000 })
      .toEqual([{ reason: 'country_11' }]);
    // The locked card opens the paywall, not the dish.
    expect(await eventNamed(page, 'dish_opened')).toEqual([]);
    await expect
      .poll(async () => (await eventNamed(page, 'suggestions_shown')).map((item) => item.page), {
        timeout: 15_000,
      })
      .toEqual([0, 0, 1]);
  });
});
