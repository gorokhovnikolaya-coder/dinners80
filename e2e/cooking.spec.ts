import type { Page } from '@playwright/test';

import { expect, shot, test } from './fixtures.ts';

/** Thursday evening in Moscow: the same daily suggestions on every run. */
const THURSDAY = new Date('2026-10-08T18:00:00+03:00');
const MINUTE = 60_000;

const step = (page: Page) => page.getByRole('region', { name: /^Шаг \d+$/ });
const stepText = (page: Page) => step(page).locator('p');
const progress = (page: Page) => page.getByRole('progressbar', { name: 'Шаги рецепта' });
const next = (page: Page) => page.getByRole('button', { name: 'Следующий шаг' });
const telegramBack = (page: Page) => page.getByRole('button', { name: 'Назад (кнопка Telegram)' });
const mockParams = (page: Page) => page.evaluate(() => window.__tgMockParams ?? {});

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: THURSDAY });
});

test.describe('cooking mode', () => {
  test('shows steps with amounts for the servings, runs timers and finishes', async ({ page }) => {
    await page.goto('/dishes/pe-lomo-saltado?user=1002&mock_reset=1');
    // 3 servings instead of 2: the steps get the recalculated amounts.
    await page.getByRole('button', { name: 'Больше порций' }).click();
    await page.getByRole('button', { name: 'Начать готовить' }).click();

    await expect(page).toHaveURL('/dishes/pe-lomo-saltado/cook');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ломо сальтадо');
    await expect(progress(page)).toHaveAttribute('aria-valuetext', 'Шаг 1 из 4');
    await expect(page.getByText('1 / 4')).toBeVisible();
    await expect(step(page).getByRole('heading')).toHaveText('Шаг 1');
    await expect(stepText(page)).toHaveText(
      'Нарежьте 4,5 шт картофеля брусками и обжарьте до золотистого цвета.',
    );
    // The step font is at least 20 px (ТЗ).
    const fontSize = await stepText(page).evaluate((node) => getComputedStyle(node).fontSize);
    expect(Number.parseFloat(fontSize)).toBeGreaterThanOrEqual(20);
    await expect(page.getByRole('button', { name: 'Назад', exact: true })).toBeDisabled();
    // Vertical swipes of Telegram are off in the cooking mode.
    expect((await mockParams(page)).web_app_setup_swipe_behavior).toEqual({
      allow_vertical_swipe: false,
    });
    await expect(page.getByRole('timer')).toHaveText('12:00');
    await shot(page, '01-step');

    // The timer of step 1 keeps counting on the next steps.
    await page.getByRole('button', { name: /^Запустить таймер/ }).click();
    await expect(page.getByRole('button', { name: /^Пауза/ })).toBeVisible();
    await page.clock.fastForward(MINUTE);
    await expect(page.getByRole('timer')).toHaveText('11:00');

    await next(page).click();
    await expect(step(page).getByRole('heading')).toHaveText('Шаг 2');
    await expect(stepText(page)).toHaveText('Отварите 230 г риса.');
    expect((await mockParams(page)).web_app_trigger_haptic_feedback).toEqual({
      type: 'impact',
      impact_style: 'medium',
    });
    const others = page.getByRole('list', { name: 'Таймеры других шагов' });
    await expect(others).toHaveText('Шаг 1 · 11:00');

    await next(page).click();
    await expect(stepText(page)).toHaveText(
      'Обжарьте 600 г говяжьей вырезки полосками на очень сильном огне.',
    );
    await page.getByRole('button', { name: /^Запустить таймер/ }).click();
    await page.clock.fastForward(MINUTE);
    await expect(page.getByRole('timer')).toHaveText('2:00');
    await expect(others).toHaveText('Шаг 1 · 10:00');
    await shot(page, '02-timers-running');

    // Pause and continue.
    await page.getByRole('button', { name: /^Пауза/ }).click();
    await page.clock.fastForward(MINUTE);
    await expect(page.getByRole('timer')).toHaveText('2:00');
    await page.getByRole('button', { name: /^Продолжить/ }).click();

    // The end: vibration (Telegram haptics), sound and «Время вышло».
    await page.clock.fastForward(2 * MINUTE + 1_000);
    await expect(page.getByRole('button', { name: /^Время вышло/ })).toBeVisible();
    await expect(page.getByRole('timer')).toHaveText('0:00');
    await expect(page.getByRole('status').filter({ hasText: 'время вышло' })).toHaveText(
      'Шаг 3: время вышло',
    );
    expect((await mockParams(page)).web_app_trigger_haptic_feedback).toEqual({
      type: 'notification',
      notification_type: 'warning',
    });
    await shot(page, '03-timer-done');

    // Reset brings the full time back.
    await page.getByRole('button', { name: 'Сбросить таймер' }).click();
    await expect(page.getByRole('timer')).toHaveText('3:00');
    await expect(page.getByRole('button', { name: /^Запустить таймер/ })).toBeVisible();

    // «Назад» goes to the previous step; another timer is one tap away.
    await page.getByRole('button', { name: 'Назад', exact: true }).click();
    await expect(step(page).getByRole('heading')).toHaveText('Шаг 2');
    await others.getByRole('button', { name: /^Шаг 1/ }).click();
    await expect(step(page).getByRole('heading')).toHaveText('Шаг 1');
    await expect(page.getByRole('button', { name: /^Пауза/ })).toBeVisible();

    for (let index = 0; index < 3; index += 1) await next(page).click();
    await expect(stepText(page)).toHaveText(
      'Добавьте 1,5 шт красного лука, 3 шт томатов и 4,5 ст. л. соевого соуса, через минуту — картофель.',
    );
    await expect(next(page)).toHaveCount(0);
    await shot(page, '04-last-step');

    // «Готово!» leads to the photo and stamp screen.
    await page.getByRole('button', { name: 'Готово!' }).click();
    await expect(page).toHaveURL('/dishes/pe-lomo-saltado/done');
    await expect(page.getByRole('heading', { name: 'Сфотографируйте блюдо' })).toBeVisible();
    expect((await mockParams(page)).web_app_setup_swipe_behavior).toEqual({
      allow_vertical_swipe: true,
    });

    // The cooked dish starts from step 1 again, with no timers.
    await page.goto('/dishes/pe-lomo-saltado/cook');
    await expect(step(page).getByRole('heading')).toHaveText('Шаг 1');
    await expect(page.getByRole('button', { name: /^Запустить таймер/ })).toBeVisible();
  });

  test('«Назад» of Telegram returns to the card; the step and the timers are kept', async ({
    page,
  }) => {
    await page.goto('/dishes/it-lasagna?user=1002&mock_reset=1');
    await page.getByRole('button', { name: 'Начать готовить' }).click();
    await page.getByRole('button', { name: /^Запустить таймер/ }).click();
    await next(page).click();
    await expect(stepText(page)).toHaveText('Добавьте 400 г томатов и томите рагу под крышкой.');

    await telegramBack(page).click();
    await expect(page).toHaveURL(/\/dishes\/it-lasagna(\?|$)/);
    expect((await mockParams(page)).web_app_setup_swipe_behavior).toEqual({
      allow_vertical_swipe: true,
    });
    // The timer ends while the user is on the card: no signal, «Время вышло» on return.
    await page.clock.fastForward(11 * MINUTE);

    await page.getByRole('button', { name: 'Начать готовить' }).click();
    await expect(step(page).getByRole('heading')).toHaveText('Шаг 2');
    await expect(page.getByRole('list', { name: 'Таймеры других шагов' })).toHaveText(
      'Шаг 1 · время вышло',
    );
    // The last haptic is still the tap of «Следующий шаг», not the alarm.
    expect((await mockParams(page)).web_app_trigger_haptic_feedback).toEqual({
      type: 'impact',
      impact_style: 'medium',
    });
  });

  test('opened directly: loading error with «Повторить», «Назад» leads to the card', async ({
    page,
  }) => {
    await page.goto('/dishes/fr-omelette/cook?user=1002&mock_reset=1&mock_error=dish');
    await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible();
    await shot(page, '05-error');
    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(stepText(page)).toHaveText('Взбейте 4 шт яиц с солью до однородности.');

    await telegramBack(page).click();
    await expect(page).toHaveURL('/dishes/fr-omelette');
  });

  test('a closed country opens the paywall', async ({ page }) => {
    await page.goto('/?user=1003&mock_reset=1');
    const locked = page
      .getByRole('region', { name: 'Предложения на ужин' })
      .getByRole('link')
      .filter({ hasText: 'Откроется с подпиской' });
    const dishId = new URLSearchParams(
      ((await locked.getAttribute('href')) ?? '').split('?')[1],
    ).get('dish');
    expect(dishId).toBeTruthy();

    await page.goto(`/dishes/${dishId ?? ''}/cook`);
    await expect(page).toHaveURL(`/paywall?dish=${dishId ?? ''}`);
    await expect(step(page)).toHaveCount(0);
  });
});
