import type { Page } from '@playwright/test';

import { expect, shot, test } from './fixtures.ts';

/** Thursday evening in Moscow: the same data on every run. */
const THURSDAY = new Date('2026-10-08T18:00:00+03:00');

const telegramBack = (page: Page) => page.getByRole('button', { name: 'Назад (кнопка Telegram)' });
const mockParams = (page: Page) => page.evaluate(() => window.__tgMockParams ?? {});
const photoInput = (page: Page) => page.getByTestId('photo-input');
const stamp = (page: Page) => page.getByTestId('stamp');

/** Opens the dish, goes through every step and taps «Готово!». */
async function cookToEnd(page: Page, dishId: string, query: string) {
  await page.goto(`/dishes/${dishId}?${query}`);
  await page.getByRole('button', { name: 'Начать готовить' }).click();
  const finish = page.getByRole('button', { name: 'Готово!' });
  while (!(await finish.isVisible())) {
    await page.getByRole('button', { name: 'Следующий шаг' }).click();
  }
  await finish.click();
  await expect(page).toHaveURL(`/dishes/${dishId}/done`);
  await expect(page.getByRole('heading', { name: 'Сфотографируйте блюдо' })).toBeVisible();
}

/** A 2400 × 1800 «camera» JPEG drawn in the page, as a file for the photo input. */
async function cameraPhoto(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1800;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no canvas');
    const gradient = context.createRadialGradient(1200, 900, 100, 1200, 900, 1300);
    gradient.addColorStop(0, '#f6c177');
    gradient.addColorStop(0.5, '#c2410c');
    gradient.addColorStop(1, '#3d2410');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 2400, 1800);
    context.fillStyle = '#f3e9d2';
    context.beginPath();
    context.arc(1200, 900, 620, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#d97706';
    context.beginPath();
    context.arc(1200, 900, 480, 0, Math.PI * 2);
    context.fill();
    return canvas.toDataURL('image/jpeg', 0.95).split(',')[1] ?? '';
  });
  return { name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(base64, 'base64') };
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: THURSDAY });
});

test.describe('photo and stamp', () => {
  test('a photo of a new country: compressed upload, stamp, vibration, overtaken friend', async ({
    page,
  }) => {
    await cookToEnd(page, 'in-dal', 'user=1002&mock_reset=1');
    await expect(page.getByRole('button', { name: 'Сфотографировать' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Без фото' })).toBeVisible();
    await shot(page, '01-photo-choose');

    await photoInput(page).setInputFiles(await cameraPhoto(page));
    await expect(page.getByText('Новая страна!')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Индия в паспорте');
    await expect(page.getByText('Дал из красной чечевицы · 11-е блюдо')).toBeVisible();
    await expect(page.getByText('9 из 12 стран')).toBeVisible();
    await expect(page.getByText('+1 сегодня')).toBeVisible();
    await expect(page.getByText('Жанна теперь позади вас в рейтинге друзей')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Штамп: Индия, 08.10.2026' })).toBeVisible();
    await expect(stamp(page)).toContainText('Индия');
    // The user's own (compressed) photo is shown, not the content one.
    const photo = page.getByRole('img', { name: 'Ваше фото: Дал из красной чечевицы' });
    await expect(photo).toBeVisible();
    const size = await photo.evaluate((node: HTMLImageElement) => ({
      width: node.naturalWidth,
      height: node.naturalHeight,
    }));
    expect(size).toEqual({ width: 1600, height: 1200 });
    const params = await mockParams(page);
    expect(params.web_app_trigger_haptic_feedback).toEqual({
      type: 'notification',
      notification_type: 'success',
    });
    // The navy screen paints the Telegram header navy.
    expect(params.web_app_set_header_color).toEqual({ color: '#14213d' });
    await expect(page.getByRole('button', { name: 'Поделиться карточкой' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Открыть карту' })).toBeVisible();
    await shot(page, '02-stamp-new-country');

    // «Назад» of Telegram leads to the main screen; the header is light again.
    await telegramBack(page).click();
    await expect(page).toHaveURL('/');
    await expect
      .poll(async () => (await mockParams(page)).web_app_set_header_color)
      .toEqual({ color: '#f3f5f7' });
    await expect(page.getByRole('link', { name: /Пройдено стран: 9 из 12/ })).toBeVisible();

    // The screen opens only right after «Готово!»: no second cook by a link or a reload.
    await page.goto('/dishes/in-dal/done');
    await expect(page).toHaveURL('/dishes/in-dal');
    await expect(page.getByText('Уже готовили').first()).toBeVisible();
  });

  test('a repeated dish without a photo: counted, no stamp', async ({ page }) => {
    await cookToEnd(page, 'pe-lomo-saltado', 'user=1002&mock_reset=1');
    await page.getByRole('button', { name: 'Без фото' }).click();

    await expect(page.getByText('Блюдо засчитано')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ломо сальтадо');
    await expect(page.getByText('Перу · 11-е блюдо')).toBeVisible();
    await expect(page.getByText('8 из 12 стран')).toBeVisible();
    await expect(page.getByText('+1 сегодня')).toHaveCount(0);
    await expect(stamp(page)).toHaveCount(0);
    await expect(page.getByText(/позади вас/)).toHaveCount(0);
    // Without a photo — the photo of the dish from the content.
    await expect(page.getByRole('img', { name: 'Фото: Ломо сальтадо' })).toBeVisible();
    expect((await mockParams(page)).web_app_trigger_haptic_feedback).not.toEqual({
      type: 'notification',
      notification_type: 'success',
    });
    await shot(page, '03-repeat-dish');
  });

  test('a failed upload is retried', async ({ page }) => {
    await cookToEnd(page, 'in-dal', 'user=1002&mock_reset=1&mock_error=upload');
    await photoInput(page).setInputFiles(await cameraPhoto(page));
    await expect(page.getByRole('status')).toHaveText('Не удалось загрузить фото');
    await expect(page.getByRole('img', { name: 'Ваше фото: Дал из красной чечевицы' })).toBeVisible();
    await shot(page, '04-upload-error');

    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Индия в паспорте');
    await expect(page.getByRole('img', { name: 'Ваше фото: Дал из красной чечевицы' })).toBeVisible();
  });

  test('after a failed upload the cook is recorded without a photo', async ({ page }) => {
    await cookToEnd(page, 'in-dal', 'user=1002&mock_reset=1&mock_error=upload:always');
    await photoInput(page).setInputFiles(await cameraPhoto(page));
    await page.getByRole('button', { name: 'Продолжить без фото' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Индия в паспорте');
    await expect(page.getByRole('img', { name: 'Фото: Дал из красной чечевицы' })).toBeVisible();
    await expect(stamp(page)).toBeVisible();
  });

  test('a failed save is retried', async ({ page }) => {
    await cookToEnd(page, 'fr-omelette', 'user=1002&mock_reset=1&mock_error=cooks');
    await page.getByRole('button', { name: 'Без фото' }).click();
    await expect(page.getByRole('status')).toHaveText('Не удалось сохранить готовку');
    await shot(page, '05-save-error');
    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByText('Блюдо засчитано')).toBeVisible();
  });

  test('opened directly: leads to the dish card', async ({ page }) => {
    await page.goto('/dishes/in-dal/done?user=1002&mock_reset=1');
    await expect(page).toHaveURL('/dishes/in-dal');
    await expect(page.getByRole('button', { name: 'Начать готовить' })).toBeVisible();
  });
});
