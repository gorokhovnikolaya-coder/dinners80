import type { Page } from '@playwright/test';

import { expect, shot, test } from './fixtures.ts';

/** Thursday evening in Moscow: the same daily suggestions on every run. */
const THURSDAY = new Date('2026-10-08T18:00:00+03:00');

const suggestions = (page: Page) =>
  page.getByRole('region', { name: 'Предложения на ужин' }).getByRole('link');
const plan = (page: Page, name: 'Год' | 'Месяц') =>
  page.getByRole('radio', { name: new RegExp(`^${name}`) });
const payButton = (page: Page) => page.getByRole('button', { name: 'Продолжить путешествие' });
const telegramBack = (page: Page) => page.getByRole('button', { name: 'Назад (кнопка Telegram)' });
/** Slug of the last invoice the app opened in the mock Telegram client. */
const openedInvoice = (page: Page) =>
  page.evaluate(() => {
    const params = window.__tgMockParams?.web_app_open_invoice as { slug?: string } | undefined;
    return params?.slug ?? '';
  });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(THURSDAY);
});

test.describe('paywall', () => {
  test('a free user with 10 countries pays for a year from a locked dish and gets the dish', async ({
    page,
  }) => {
    await page.goto('/?user=1003&mock_reset=1');
    const locked = suggestions(page).filter({ hasText: 'Откроется с подпиской' });
    const dishId = new URLSearchParams(
      ((await locked.getAttribute('href')) ?? '').split('?')[1],
    ).get('dish');
    expect(dishId).toBeTruthy();
    await locked.click();
    await expect(page).toHaveURL(`/paywall?dish=${dishId ?? ''}`);

    await expect(page.getByRole('img', { name: 'Карта: пройдено 10 из 12 стран' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '10 стран позади.Ещё 2 ждут вас',
    );
    await expect(
      page.getByText(
        /^(Таиланд|Колумбия) откроется с подпиской\. Ваш паспорт и штампы останутся с вами\.$/,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Что даёт подписка' }).getByRole('listitem'),
    ).toHaveText([
      'Все 12 стран и 36 проверенных рецептов',
      'Новые страны в ежедневной подборке ужинов',
      'Весь паспорт: штампы всех 12 стран',
    ]);
    await expect(page.getByRole('group', { name: 'Тариф' })).toBeVisible();
    await expect(plan(page, 'Год')).toBeChecked();
    await expect(plan(page, 'Год')).toHaveAccessibleName(/≈ 100 Stars в месяц.*1\s200 Stars/);
    await expect(plan(page, 'Месяц')).not.toBeChecked();
    await expect(plan(page, 'Месяц')).toHaveAccessibleName(
      /Продлевается каждые 30 дней.*150 Stars/,
    );
    await shot(page, '01-paywall-dish');

    // The mock Telegram client pays the invoice (`?mock_invoice=paid` by default).
    await payButton(page).click();
    await expect(page).toHaveURL(`/dishes/${dishId ?? ''}`);
    await expect(page.getByRole('region', { name: 'Ингредиенты' })).toBeVisible();
    expect(await openedInvoice(page)).toMatch(/^mock-year-/);
    await shot(page, '02-paid-dish');

    // The paywall was replaced in history: «Назад» leads to the main screen, without locks now.
    await telegramBack(page).click();
    await expect(page).toHaveURL(/:\d+\/(\?[^/]*)?$/);
    await expect(suggestions(page)).toHaveCount(3);
    await expect(suggestions(page).filter({ hasText: 'Откроется с подпиской' })).toHaveCount(0);
  });

  test('from the profile: the month plan, a cancelled and a failed payment keep the plans', async ({
    page,
  }) => {
    await page.goto('/paywall?user=1003&mock_reset=1&mock_invoice=cancelled');
    await expect(
      page.getByText('С подпиской откроются все страны. Ваш паспорт и штампы останутся с вами.'),
    ).toBeVisible();
    await page.getByText('Месяц', { exact: true }).click();
    await expect(plan(page, 'Месяц')).toBeChecked();
    await expect(plan(page, 'Год')).not.toBeChecked();
    await shot(page, '03-paywall-profile-month');

    await payButton(page).click();
    await expect.poll(() => openedInvoice(page)).toMatch(/^mock-month-/);
    // Cancelled: nothing to say, the plans stay.
    await expect(payButton(page)).toBeEnabled();
    await expect(payButton(page)).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByText(/Оплата не прошла|Платёж обрабатывается/)).toHaveCount(0);

    await page.goto('/paywall?user=1003&mock_invoice=failed');
    await payButton(page).click();
    await expect(page.getByText('Оплата не прошла. Попробуйте ещё раз')).toBeVisible();
    await expect(payButton(page)).toBeVisible();
    await shot(page, '04-paywall-failed');

    // «Не сейчас» closes the paywall (opened directly — to the main screen, not out of the app).
    await page.getByRole('button', { name: 'Не сейчас' }).click();
    await expect(page).toHaveURL('/');
  });

  test('a pending payment offers to refresh', async ({ page }) => {
    await page.goto('/paywall?user=1003&mock_reset=1&mock_invoice=pending');
    await payButton(page).click();
    await expect(
      page.getByText(
        'Платёж обрабатывается. Подписка включится, как только Telegram его подтвердит',
      ),
    ).toBeVisible();
    await expect(plan(page, 'Год')).toBeDisabled();
    await page.getByRole('button', { name: 'Обновить' }).click();
    // The server has not seen the payment: the message stays.
    await expect(page.getByRole('button', { name: 'Обновить' })).toBeVisible();
    await expect(page.getByText(/^Платёж обрабатывается/)).toBeVisible();
    await shot(page, '05-paywall-pending');
  });

  test('an invoice that failed to open can be retried; paid from the profile shows the subscription', async ({
    page,
  }) => {
    await page.goto('/paywall?user=1003&mock_reset=1&mock_error=invoice');
    await payButton(page).click();
    await expect(page.getByText('Не удалось открыть оплату')).toBeVisible();
    await shot(page, '06-paywall-invoice-error');

    await page.getByRole('button', { name: 'Повторить' }).click();
    // Year from 8 October 2026.
    await expect(page.getByText('Подписка активна до 8 октября 2027 г.')).toBeVisible();
    await expect(page.getByText('Подписка открыла все страны.')).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Не сейчас' })).toHaveCount(0);
  });

  test('a paid invoice the server does not confirm in 15 s', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/paywall?user=1003&mock_reset=1&mock_invoice=unconfirmed');
    await payButton(page).click();
    await expect(page.getByRole('button', { name: 'Подтверждаем оплату…' })).toBeVisible();
    await shot(page, '07-paywall-confirming');
    await expect(page.getByText('Оплата прошла, подписка включится в течение минуты')).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByRole('button', { name: 'Обновить' })).toBeVisible();
    await shot(page, '08-paywall-unconfirmed');
  });

  test('a subscriber sees the end date instead of the plans', async ({ page }) => {
    await page.goto('/paywall?user=1004&mock_reset=1');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '10 стран позади.Ещё 2 ждут вас',
    );
    await expect(page.getByText('Подписка открыла все страны.')).toBeVisible();
    await expect(page.getByText('Подписка активна до 28 октября')).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Не сейчас' })).toHaveCount(0);
    await shot(page, '09-paywall-active');

    await page.getByRole('button', { name: 'Продолжить путешествие' }).click();
    await expect(page).toHaveURL('/');
  });

  test('an open dish is shown instead of the paywall', async ({ page }) => {
    await page.goto('/paywall?dish=pe-ceviche&user=1003&mock_reset=1');
    await expect(page).toHaveURL('/dishes/pe-ceviche');
  });

  test('shows loading and an error with retry', async ({ page }) => {
    await page.goto('/paywall?user=1003&mock_reset=1&mock_delay=1500');
    // After the light start-up skeleton (`POST /auth`), the navy one of the paywall.
    await expect(
      page.locator('main.bg-ink').getByRole('status').filter({ hasText: 'Загрузка…' }),
    ).toBeVisible();
    await shot(page, '10-paywall-loading');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.goto('/paywall?user=1003&mock_error=map');
    await expect(page.getByRole('alert')).toHaveText('Не удалось загрузить данные.');
    await shot(page, '11-paywall-error');
    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '10 стран позади.Ещё 2 ждут вас',
    );
  });

  test('the navy screen paints the Telegram header and has 44 px touch targets', async ({
    page,
  }) => {
    await page.goto('/paywall?user=1003&mock_reset=1');
    await expect(payButton(page)).toBeVisible();
    const colors = await page.evaluate(() => window.__tgMockParams?.web_app_set_header_color);
    expect(colors).toEqual({ color: '#14213d' });
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('main button, main a, main label')]
        .map((el) => {
          const { width, height } = el.getBoundingClientRect();
          return { text: el.textContent, width, height };
        })
        .filter((box) => box.width < 44 || box.height < 44),
    );
    expect(small).toEqual([]);
  });
});
