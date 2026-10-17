import type { Page } from '@playwright/test';

import { expect, shot, test } from './fixtures.ts';

/** Thursday evening in Moscow: the week began on Monday 5 October 00:00. Fixture cooks are relative to it. */
const THURSDAY = new Date('2026-10-08T18:00:00+03:00');

const ranking = (page: Page) =>
  page.getByRole('region', { name: 'Рейтинг друзей' }).getByRole('listitem');
const feed = (page: Page) =>
  page.getByRole('region', { name: 'Последние штампы' }).getByRole('listitem');
const invite = (page: Page) => page.getByRole('button', { name: 'Позвать друга в Telegram' });
const period = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Период рейтинга' }).getByRole('button', { name });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(THURSDAY);
});

test.describe('friends', () => {
  test('a friend who opened the invitation link appears in the ranking', async ({ page }) => {
    // Аня (1001) opens t.me/<bot>/<app>?startapp=<code of Борис (1002)>.
    await page.goto('/?user=1001&mock_reset=1&startapp=inv1002');
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.goto('/friends?user=1002');
    await expect(ranking(page)).toHaveCount(5);
    await expect(ranking(page).filter({ hasText: 'Аня' })).toHaveCount(1);
  });

  test('ranking for the week and all time, the stamps feed and the invite', async ({ page }) => {
    await page.goto('/?user=1002&mock_reset=1');
    await page
      .getByRole('navigation', { name: 'Разделы' })
      .getByRole('link', { name: 'Друзья' })
      .click();
    await expect(page).toHaveURL(/\/friends$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Друзья');

    // «Эта неделя» by default: new countries and cooks since Monday; equal rows share a place.
    await expect(period(page, 'Эта неделя')).toHaveAttribute('aria-pressed', 'true');
    await expect(ranking(page)).toHaveCount(4);
    await expect(ranking(page).nth(0)).toContainText('1-е место');
    await expect(ranking(page).nth(0)).toContainText('Жанна');
    await expect(ranking(page).nth(0)).toContainText('3 блюда');
    await expect(ranking(page).nth(0)).toContainText('2 страны');
    await expect(ranking(page).nth(1)).toContainText('Вы');
    await expect(ranking(page).nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(ranking(page).nth(1)).toContainText('2 блюда');
    await expect(ranking(page).nth(2)).toContainText('3-е место');
    await expect(ranking(page).nth(2)).toContainText('Егор');
    await expect(ranking(page).nth(3)).toContainText('3-е место');
    await expect(ranking(page).nth(3)).toContainText('Зоя');

    // The feed: first stamps of friends, newest first, with and without a photo.
    await expect(feed(page)).toHaveCount(20);
    await expect(feed(page).first()).toContainText('Егор — Перу в паспорте');
    await expect(feed(page).first()).toContainText('Ломо сальтадо · вчера');
    await expect(
      feed(page).first().getByRole('img', { name: 'Фото: Ломо сальтадо' }),
    ).toBeVisible();
    await expect(feed(page).nth(1)).toContainText('Зоя — Колумбия в паспорте');
    await expect(feed(page).nth(1).getByRole('img')).toHaveCount(0);
    // Жанна's paella this week is a repeat (Spain), not a stamp.
    await expect(feed(page).filter({ hasText: 'Паэлья' })).toHaveCount(0);
    await expect(feed(page).filter({ hasText: 'Жанна — Испания в паспорте' })).toContainText(
      'Тортилья по-испански',
    );
    await shot(page, '01-friends-week');

    // «Всё время»: passed countries and all cooks.
    await period(page, 'Всё время').click();
    await expect(period(page, 'Всё время')).toHaveAttribute('aria-pressed', 'true');
    await expect(ranking(page).nth(0)).toContainText('Зоя');
    await expect(ranking(page).nth(0)).toContainText('11 стран');
    await expect(ranking(page).nth(1)).toContainText('Вы');
    await expect(ranking(page).nth(1)).toContainText('10 блюд');
    await expect(ranking(page).nth(2)).toContainText('Жанна');
    await expect(ranking(page).nth(3)).toContainText('Егор');
    await shot(page, '02-friends-all-time');

    // The choice stays while the app is open.
    await page.getByRole('link', { name: 'Ужин' }).click();
    await page.getByRole('link', { name: 'Друзья' }).click();
    await expect(period(page, 'Всё время')).toHaveAttribute('aria-pressed', 'true');

    // The invite opens Telegram's share link with the invite code and the text.
    await invite(page).scrollIntoViewIfNeeded();
    await shot(page, '03-friends-invite', { fullPage: true });
    await invite(page).click();
    const shared = await page.evaluate(() => window.__tgMockParams?.web_app_open_tg_link);
    const pathFull = (shared as { path_full?: unknown } | undefined)?.path_full;
    expect(pathFull).toMatch(/^\/share\/url\?/);
    if (typeof pathFull !== 'string') throw new Error('No share link opened');
    const params = new URLSearchParams(pathFull.slice(pathFull.indexOf('?')));
    expect(params.get('url')).toBe('https://t.me/tma80_dev_bot/app?startapp=inv1002');
    expect(params.get('text')).toBe(
      'Готовлю ужины из кухонь разных стран и собираю штампы в паспорт. Присоединяйся — посоревнуемся!',
    );
  });

  test('without friends: only the invite', async ({ page }) => {
    await page.goto('/?user=1001&mock_reset=1');
    // The newbie answers the onboarding first.
    await page.getByText('Я один').click();
    await page.getByRole('button', { name: 'Дальше' }).click();
    await page.getByText('20 минут').click();
    await page.getByRole('button', { name: 'Дальше' }).click();
    await page.getByRole('button', { name: 'Дальше' }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole('link', { name: 'Друзья' }).click();
    await expect(page.getByRole('status')).toHaveText('Позовите друзей, чтобы соревноваться');
    await expect(invite(page)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Период рейтинга' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Последние штампы' })).toHaveCount(0);
    await shot(page, '04-friends-empty');
  });

  test('loading, then an error with «Повторить»', async ({ page }) => {
    await page.goto('/friends?user=1002&mock_reset=1&mock_error=friends&mock_delay=1500');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Друзья');
    await expect(page.getByRole('status').filter({ hasText: 'Загрузка…' })).toBeVisible();
    await shot(page, '05-friends-loading');
    await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible();
    await shot(page, '06-friends-error');
    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(ranking(page)).toHaveCount(4);
  });

  test('a failed feed has its own «Повторить»; the ranking stays', async ({ page }) => {
    await page.goto('/friends?user=1002&mock_reset=1&mock_error=friends_feed');
    await expect(ranking(page)).toHaveCount(4);
    const region = page.getByRole('region', { name: 'Последние штампы' });
    await expect(region).toContainText('Не удалось загрузить штампы друзей.');
    await region.getByRole('button', { name: 'Повторить' }).click();
    await expect(feed(page)).toHaveCount(20);
  });
});
