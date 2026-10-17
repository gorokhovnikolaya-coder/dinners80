import type { Page } from '@playwright/test';

import { expect, shot, test } from './fixtures.ts';

/** Thursday evening in Moscow: the same data on every run. */
const THURSDAY = new Date('2026-10-08T18:00:00+03:00');

const mockParams = (page: Page) => page.evaluate(() => window.__tgMockParams ?? {});
const mockCalls = (page: Page) => page.evaluate(() => window.__tgMockCalls ?? []);
const sheet = (page: Page) => page.getByTestId('share-sheet');

/** Opens the dish, goes through every step, taps «Готово!» and «Без фото». */
async function cookWithoutPhoto(page: Page, dishId: string, query: string) {
  await page.goto(`/dishes/${dishId}?${query}`);
  await page.getByRole('button', { name: 'Начать готовить' }).click();
  const finish = page.getByRole('button', { name: 'Готово!' });
  while (!(await finish.isVisible())) {
    await page.getByRole('button', { name: 'Следующий шаг' }).click();
  }
  await finish.click();
  await page.getByRole('button', { name: 'Без фото' }).click();
  await expect(page.getByRole('button', { name: 'Поделиться карточкой' })).toBeVisible();
}

/** The picture of the card at its public URL (the mock serves the uploaded cards). */
async function cardAt(page: Page, url: string): Promise<Buffer> {
  const base64 = await page.evaluate(async (src) => {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`card ${src}: ${String(response.status)}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }, url);
  return Buffer.from(base64, 'base64');
}

/** Waits for the card upload and returns the card URL from its response. */
async function uploadedCardUrl(page: Page, action: () => Promise<void>): Promise<string> {
  const response = page.waitForResponse(
    (item) => item.url().includes('/uploads/share-card?cookId=') && item.ok(),
  );
  await action();
  return ((await (await response).json()) as { url: string }).url;
}

/** Shows the uploaded card on its own page and saves its screenshot (`docs/screens/`). */
async function shotCard(page: Page, card: Buffer, name: string) {
  const view = await page.context().newPage();
  await view.setViewportSize({ width: 390, height: 693 });
  await view.setContent(
    `<body style="margin:0"><img alt="card" style="display:block;width:390px" src="data:image/jpeg;base64,${card.toString('base64')}"></body>`,
  );
  const size = await view
    .getByRole('img', { name: 'card' })
    .evaluate((node: HTMLImageElement) => [node.naturalWidth, node.naturalHeight]);
  expect(size).toEqual([1080, 1920]);
  await shot(view, name);
  await view.close();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: THURSDAY });
});

test.describe('share the stamp', () => {
  test('a story with the card of a new country and the invite link', async ({ page }) => {
    await cookWithoutPhoto(page, 'in-dal', 'user=1002&mock_reset=1');
    await page.getByRole('button', { name: 'Поделиться карточкой' }).click();
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByRole('heading', { name: 'Поделиться карточкой' })).toBeVisible();
    await expect(sheet(page).getByRole('button', { name: 'В историю' })).toBeVisible();
    await expect(sheet(page).getByRole('button', { name: 'Отправить в чат' })).toBeVisible();
    await expect(sheet(page).getByRole('button', { name: 'Отмена' })).toBeVisible();
    await shot(page, '01-share-sheet');

    await sheet(page).getByRole('button', { name: 'В историю' }).click();
    await expect(sheet(page)).toBeHidden();

    const story = (await mockParams(page)).web_app_share_to_story as {
      media_url: string;
      text: string;
      widget_link?: unknown;
    };
    expect(story.media_url).toMatch(/^http:\/\/localhost:\d+\/media\/share\/[0-9a-f-]{36}\.jpg$/);
    expect(story.text).toBe(
      'Индия в паспорте! 9 из 12 стран. Собираю штампы за ужинами — присоединяйся: ' +
        'https://t.me/tma80_dev_bot/app?startapp=inv1002',
    );
    // A regular user cannot post a link widget: it is not passed.
    expect(story.widget_link).toBeUndefined();
    const card = await cardAt(page, story.media_url);
    expect(card.length).toBeGreaterThan(10_000);
    expect(card.length).toBeLessThanOrEqual(2 * 1024 * 1024);
    await shotCard(page, card, '02-card-new-country');

    // The card is uploaded once per cook: the chat reuses it.
    let uploads = 0;
    page.on('request', (request) => {
      if (request.url().includes('/uploads/share-card')) uploads += 1;
    });
    await page.getByRole('button', { name: 'Поделиться карточкой' }).click();
    await sheet(page).getByRole('button', { name: 'Отправить в чат' }).click();
    await expect(sheet(page)).toBeHidden();
    await expect
      .poll(async () => (await mockParams(page)).web_app_send_prepared_message)
      .toEqual({ id: expect.stringMatching(/^mock-prepared-[0-9a-f-]{36}$/) as unknown });
    expect(uploads).toBe(0);
  });

  test('the card carries the user\'s own photo', async ({ page }) => {
    await page.goto('/dishes/in-dal?user=1002&mock_reset=1');
    await page.getByRole('button', { name: 'Начать готовить' }).click();
    const finish = page.getByRole('button', { name: 'Готово!' });
    while (!(await finish.isVisible())) {
      await page.getByRole('button', { name: 'Следующий шаг' }).click();
    }
    await finish.click();
    // A «camera» photo: a dark plate on a bright orange table.
    const base64 = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1200;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no canvas');
      context.fillStyle = '#e8590c';
      context.fillRect(0, 0, 1600, 1200);
      context.fillStyle = '#f8f0e3';
      context.beginPath();
      context.arc(800, 600, 450, 0, Math.PI * 2);
      context.fill();
      return canvas.toDataURL('image/jpeg', 0.9).split(',')[1] ?? '';
    });
    await page.getByTestId('photo-input').setInputFiles({
      name: 'IMG_0002.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(base64, 'base64'),
    });
    await page.getByRole('button', { name: 'Поделиться карточкой' }).click();
    await sheet(page).getByRole('button', { name: 'В историю' }).click();
    await expect(sheet(page)).toBeHidden();
    const story = (await mockParams(page)).web_app_share_to_story as { media_url: string };
    await shotCard(page, await cardAt(page, story.media_url), '06-card-user-photo');
  });

  test('a Premium user also gets the link widget in the story', async ({ page }) => {
    await cookWithoutPhoto(page, 'in-dal', 'user=1002&mock_reset=1&mock_premium=1');
    await page.getByRole('button', { name: 'Поделиться карточкой' }).click();
    await sheet(page).getByRole('button', { name: 'В историю' }).click();
    await expect(sheet(page)).toBeHidden();
    const story = (await mockParams(page)).web_app_share_to_story as { widget_link?: unknown };
    expect(story.widget_link).toEqual({
      url: 'https://t.me/tma80_dev_bot/app?startapp=inv1002',
      name: 'Открыть',
    });
  });

  test('a repeated dish: the card without the stamp, sent to a chat', async ({ page }) => {
    await cookWithoutPhoto(page, 'pe-lomo-saltado', 'user=1002&mock_reset=1');
    await expect(page.getByText('Блюдо засчитано')).toBeVisible();
    await page.getByRole('button', { name: 'Поделиться карточкой' }).click();
    const url = await uploadedCardUrl(page, () =>
      sheet(page).getByRole('button', { name: 'Отправить в чат' }).click(),
    );
    await expect(sheet(page)).toBeHidden();
    const card = await cardAt(page, url);
    await expect
      .poll(async () => (await mockCalls(page)).includes('web_app_send_prepared_message'))
      .toBe(true);
    await shotCard(page, card, '03-card-repeat');
  });

  test('a failed upload offers a retry', async ({ page }) => {
    await cookWithoutPhoto(page, 'in-dal', 'user=1002&mock_reset=1&mock_error=share_card');
    await page.getByRole('button', { name: 'Поделиться карточкой' }).click();
    await sheet(page).getByRole('button', { name: 'Отправить в чат' }).click();
    await expect(sheet(page).getByText('Не удалось подготовить карточку')).toBeVisible();
    await shot(page, '04-share-error');
    await sheet(page).getByRole('button', { name: 'Повторить' }).click();
    await expect(sheet(page)).toBeHidden();
    await expect
      .poll(async () => (await mockCalls(page)).includes('web_app_send_prepared_message'))
      .toBe(true);
  });

  test('the server cannot prepare the message: the invite link by t.me/share/url', async ({
    page,
  }) => {
    await cookWithoutPhoto(page, 'in-dal', 'user=1002&mock_reset=1&mock_error=share_unavailable');
    await page.getByRole('button', { name: 'Поделиться карточкой' }).click();
    await sheet(page).getByRole('button', { name: 'Отправить в чат' }).click();
    await expect(sheet(page)).toBeHidden();
    const link = await page.evaluate(() => window.__tgMockParams?.web_app_open_tg_link);
    const shared = new URL(`https://t.me${(link as { path_full: string }).path_full}`);
    expect(shared.pathname).toBe('/share/url');
    expect(shared.searchParams.get('url')).toBe('https://t.me/tma80_dev_bot/app?startapp=inv1002');
    expect(shared.searchParams.get('text')).toBe(
      'Индия в паспорте — уже 9 из 12 стран! Готовлю ужины из кухонь разных стран и собираю ' +
        'штампы. Присоединяйся — посоревнуемся!',
    );
    expect(await mockCalls(page)).not.toContain('web_app_send_prepared_message');
  });

  test('an old client: no stories, the chat falls back to t.me/share/url', async ({ page }) => {
    await cookWithoutPhoto(page, 'in-dal', 'user=1002&mock_reset=1&mock_tg_version=7.0');
    await page.getByRole('button', { name: 'Поделиться карточкой' }).click();
    await expect(sheet(page).getByRole('button', { name: 'Отправить в чат' })).toBeVisible();
    await expect(sheet(page).getByRole('button', { name: 'В историю' })).toHaveCount(0);
    await shot(page, '05-share-sheet-old-client');
    await sheet(page).getByRole('button', { name: 'Отправить в чат' }).click();
    await expect(sheet(page)).toBeHidden();
    expect(await mockCalls(page)).toContain('web_app_open_tg_link');
    expect(await mockCalls(page)).not.toContain('web_app_send_prepared_message');
  });

  test('«Отмена» closes the sheet', async ({ page }) => {
    await cookWithoutPhoto(page, 'in-dal', 'user=1002&mock_reset=1');
    await page.getByRole('button', { name: 'Поделиться карточкой' }).click();
    await sheet(page).getByRole('button', { name: 'Отмена' }).click();
    await expect(sheet(page)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Поделиться карточкой' })).toBeFocused();
  });
});
