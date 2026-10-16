import type { Page } from '@playwright/test';

import { expect, shot, test } from './fixtures.ts';

/** Thursday evening in Moscow: fixed dates of the subscriptions (fixtures are relative to now). */
const THURSDAY = new Date('2026-10-08T18:00:00+03:00');

const reminder = (page: Page) => page.getByRole('switch', { name: 'Напоминание об ужине' });
const reminderTime = (page: Page) => page.getByRole('combobox', { name: 'Время' });
const telegramBack = (page: Page) => page.getByRole('button', { name: 'Назад (кнопка Telegram)' });
const saveError = (page: Page) =>
  page.getByRole('alert').filter({ hasText: 'Не удалось сохранить' });
/** Mini Apps methods the app called in the mock Telegram client. */
const telegramCalls = (page: Page) => page.evaluate(() => window.__tgMockCalls ?? []);

/** Opens the main screen as the test user and goes to the profile by the avatar. */
async function openProfile(page: Page, user: number, name: string, query = '') {
  await page.goto(`/?user=${String(user)}&mock_reset=1${query}`);
  await page.getByRole('link', { name: `Профиль: ${name}` }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Профиль' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(THURSDAY);
});

test.describe('profile', () => {
  test('shows the user and saves every change at once, kept after a reload', async ({ page }) => {
    await openProfile(page, 1002, 'Борис');
    await expect(page.getByText('Борис', { exact: true })).toBeVisible();
    await expect(page.getByText('@boris_cook')).toBeVisible();
    await expect(page.getByText('8 из 12 стран')).toBeVisible();
    await expect(page.getByText(/^\d+ блюд[оа]?$/)).toBeVisible();
    await expect(reminder(page)).toBeChecked();
    await expect(reminder(page)).toHaveAccessibleDescription(
      'Бот пришлёт идею ужина в выбранное время',
    );
    await expect(reminderTime(page)).toHaveValue('18:00');
    await expect(page.getByText('Бесплатно — 10 стран на выбор')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Открыть все страны' })).toBeVisible();
    // The onboarding answers with the onboarding controls.
    await expect(page.getByRole('group', { name: 'Кто ест' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Мы вдвоём/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /30 минут/ })).toBeChecked();
    await expect(
      page.getByRole('list', { name: 'Ваши исключения' }).getByRole('listitem'),
    ).toHaveText(['свин']);
    await expect(page.getByRole('link', { name: 'Условия использования' })).toBeVisible();
    await shot(page, '01-profile');
    await shot(page, '02-profile-full', { fullPage: true });

    await reminderTime(page).selectOption('19:30');
    await page.getByText('Я один').click();
    await page.getByText('45 минут').click();
    await page.getByText('Острое').click();
    await page.getByRole('textbox', { name: 'Своё' }).fill('Грибы');
    await page.getByRole('button', { name: 'Добавить' }).click();
    await expect(
      page.getByRole('list', { name: 'Ваши исключения' }).getByRole('listitem'),
    ).toHaveText(['свин', 'грибы']);

    await page.reload();
    await expect(reminderTime(page)).toHaveValue('19:30');
    await expect(page.getByRole('radio', { name: /Я один/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /45 минут/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Острое/ })).toBeChecked();
    await expect(
      page.getByRole('list', { name: 'Ваши исключения' }).getByRole('listitem'),
    ).toHaveText(['свин', 'грибы']);

    // Off: the time is hidden; it stays off after a reload.
    await reminder(page).click();
    await expect(reminder(page)).not.toBeChecked();
    await expect(reminderTime(page)).toHaveCount(0);
    await page.reload();
    await expect(reminder(page)).not.toBeChecked();

    // The new weekday time reaches the main screen.
    await telegramBack(page).click();
    await expect(
      page
        .getByRole('group', { name: 'Подборка' })
        .getByRole('button', { name: 'Будни · до 45 мин' }),
    ).toBeVisible();
  });

  test('a failed save rolls the change back and «Повторить» saves it', async ({ page }) => {
    await openProfile(page, 1002, 'Борис', '&mock_error=me');
    await page.getByText('Семья с детьми').click();
    await expect(saveError(page)).toHaveText(
      'Не удалось сохранить. Проверьте интернет и попробуйте ещё раз.',
    );
    await expect(page.getByRole('radio', { name: /Мы вдвоём/ })).toBeChecked();
    await shot(page, '03-save-error');

    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(saveError(page)).toHaveCount(0);
    await expect(page.getByRole('radio', { name: /Семья с детьми/ })).toBeChecked();
    await page.reload();
    await expect(page.getByRole('radio', { name: /Семья с детьми/ })).toBeChecked();
  });

  test('turning reminders on asks Telegram to let the bot write; allowed — on', async ({
    page,
  }) => {
    // Дина (1005): the bot cannot write to her, reminders are off.
    await openProfile(page, 1005, 'Дина');
    await expect(reminder(page)).not.toBeChecked();
    await expect(reminderTime(page)).toHaveCount(0);
    await shot(page, '04-reminder-off');

    // The mock Telegram client allows it (`?mock_write_access=allowed` by default).
    await reminder(page).click();
    await expect(reminder(page)).toBeChecked();
    await expect(reminderTime(page)).toHaveValue('18:00');
    expect(await telegramCalls(page)).toContain('web_app_request_write_access');
    await shot(page, '05-reminder-allowed');

    await page.reload();
    await expect(reminder(page)).toBeChecked();
  });

  test('a declined request keeps the reminder off without a message', async ({ page }) => {
    await openProfile(page, 1005, 'Дина', '&mock_write_access=cancelled');
    await reminder(page).click();
    await expect.poll(() => telegramCalls(page)).toContain('web_app_request_write_access');
    await expect(reminder(page)).not.toHaveAttribute('aria-busy');
    await expect(reminder(page)).not.toBeChecked();
    await expect(reminderTime(page)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('an old client without requestWriteAccess asks to update Telegram', async ({ page }) => {
    // Mini Apps 6.0: no BackButton either, so the in-page «Назад» is shown.
    await openProfile(page, 1005, 'Дина', '&mock_tg_version=6.0');
    await expect(reminder(page)).toBeDisabled();
    await expect(page.getByText('Обновите Telegram, чтобы включить напоминания')).toBeVisible();
    await shot(page, '06-old-client');
    await page.getByRole('button', { name: 'Назад', exact: true }).click();
    await expect(page).toHaveURL(/:\d+\/(\?[^/]*)?$/);
  });

  test('an active subscription shows its end date, without the paywall button', async ({
    page,
  }) => {
    await openProfile(page, 1004, 'Глеб');
    await expect(page.getByText('Подписка активна до 28 октября')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Открыть все страны' })).toHaveCount(0);
    await page.getByRole('heading', { name: 'Подписка' }).scrollIntoViewIfNeeded();
    await shot(page, '07-subscription-active');
  });

  test('an ended subscription shows when it ended and opens the paywall', async ({ page }) => {
    await openProfile(page, 1003, 'Вера');
    await expect(page.getByText('Подписка закончилась 28 сентября')).toBeVisible();
    await page.getByRole('heading', { name: 'Подписка' }).scrollIntoViewIfNeeded();
    await shot(page, '08-subscription-expired');
    await page.getByRole('button', { name: 'Открыть все страны' }).click();
    await expect(page).toHaveURL(/\/paywall$/);
    await expect(
      page.getByText('С подпиской откроются все страны. Ваш паспорт и штампы останутся с вами.'),
    ).toBeVisible();
    // Paid from the profile: the paywall shows the active subscription; back to the profile.
    await page.getByRole('button', { name: 'Продолжить путешествие' }).click();
    await expect(page.getByText(/^Подписка активна до /)).toBeVisible();
    await page.getByRole('button', { name: 'Продолжить путешествие' }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByText(/^Подписка активна до /)).toBeVisible();
  });

  test('documents open with Telegram openLink in Instant View', async ({ page }) => {
    await openProfile(page, 1002, 'Борис');
    await page.getByRole('link', { name: 'Политика конфиденциальности' }).click();
    const params = await page.evaluate(() => window.__tgMockParams?.web_app_open_link);
    expect(params).toEqual({ url: 'https://example.com/tma80/privacy', try_instant_view: true });
    await expect(page).toHaveURL(/\/profile$/);
  });

  test('counters show an error with «Повторить»', async ({ page }) => {
    await openProfile(page, 1002, 'Борис', '&mock_error=map');
    await expect(
      page.getByRole('alert').filter({ hasText: 'Не удалось загрузить данные.' }),
    ).toBeVisible();
    await shot(page, '09-counters-error');
    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByText('8 из 12 стран')).toBeVisible();
  });

  test('counters show a skeleton while the passport loads', async ({ page }) => {
    // Every mock response waits; the profile itself is already known from `POST /auth`.
    await openProfile(page, 1002, 'Борис', '&mock_delay=1500');
    await expect(page.getByRole('status').filter({ hasText: 'Загрузка…' })).toBeVisible();
    await expect(reminder(page)).toBeChecked();
    await shot(page, '10-counters-loading');
    await expect(page.getByText('8 из 12 стран')).toBeVisible();
  });
});
