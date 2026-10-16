import type { MapResponse } from '@tma80/shared';
import { describe, expect, it, vi } from 'vitest';

import { ru } from '../../i18n/ru.ts';
import { miniMapTiles, publishedDishesCount, waitForSubscription } from './paywall.ts';

const t = ru.paywall;

const country = (id: string, passed: boolean, dishes: number) => ({
  id,
  name: id,
  passed,
  locked: false,
  firstStampAt: null,
  dishes: Array.from({ length: dishes }, (_, index) => ({
    dishId: `${id}-${String(index)}`,
    title: 'Блюдо',
    level: 'weekday' as const,
    minutes: 30,
    imageUrl: '/x.webp',
    cooked: false,
  })),
});

const map: MapResponse = {
  countriesCount: 2,
  countriesTotal: 4,
  dishesCount: 5,
  continents: [
    { id: 'europe', countries: [country('fr', true, 3), country('it', false, 3)] },
    { id: 'asia', countries: [country('jp', false, 3), country('th', true, 2)] },
  ],
};

describe('mini-map', () => {
  it('has a tile per published country in the passport order', () => {
    expect(miniMapTiles(map)).toEqual([
      { id: 'fr', passed: true },
      { id: 'it', passed: false },
      { id: 'jp', passed: false },
      { id: 'th', passed: true },
    ]);
  });

  it('counts the published dishes', () => {
    expect(publishedDishesCount(map)).toBe(11);
  });
});

describe('paywall strings', () => {
  it('builds the title from passed and published countries', () => {
    expect(t.title(10, 30)).toEqual(['10 стран позади.', 'Ещё 20 ждут вас']);
    expect(t.title(1, 30)).toEqual(['1 страна позади.', 'Ещё 29 ждут вас']);
    expect(t.title(3, 30)).toEqual(['3 страны позади.', 'Ещё 27 ждут вас']);
    expect(t.title(9, 30)).toEqual(['9 стран позади.', 'Ещё 21 ждёт вас']);
    expect(t.title(29, 30)).toEqual(['29 стран позади.', 'Ещё 1 ждёт вас']);
    expect(t.title(19, 30)).toEqual(['19 стран позади.', 'Ещё 11 ждут вас']);
  });

  it('has its own title without countries and with all of them', () => {
    expect(t.title(0, 30)).toEqual(['30 стран ждут вас']);
    expect(t.title(0, 21)).toEqual(['21 страна ждёт вас']);
    expect(t.title(30, 30)).toEqual(['Все 30 стран позади']);
  });

  it('names the benefits with the published counts', () => {
    expect(t.benefits.all(30, 90)).toBe('Все 30 стран и 90 проверенных рецептов');
    expect(t.benefits.all(12, 36)).toBe('Все 12 стран и 36 проверенных рецептов');
    expect(t.benefits.all(21, 61)).toBe('Все 21 страна и 61 проверенный рецепт');
    expect(t.benefits.passport(30)).toBe('Весь паспорт: штампы всех 30 стран');
    expect(t.benefits.passport(21)).toBe('Весь паспорт: штампы всех 21 страны');
  });

  it('formats Stars and the plan captions', () => {
    expect(t.stars(1200).replace(/\s/g, ' ')).toBe('1 200 Stars');
    expect(t.stars(150)).toBe('150 Stars');
    expect(t.plans.year.perMonth(t.stars(100))).toBe('≈ 100 Stars в месяц');
    expect(t.plans.month.renews(30)).toBe('Продлевается каждые 30 дней');
    expect(t.subtitle.country('Марокко')).toBe(
      'Марокко откроется с подпиской. Ваш паспорт и штампы останутся с вами.',
    );
  });
});

describe('waitForSubscription', () => {
  const sleep = vi.fn(() => Promise.resolve());

  it('returns at once when the subscription is already active', async () => {
    const check = vi.fn(() => Promise.resolve(true));
    await expect(
      waitForSubscription(check, { attempts: 10, intervalMs: 1500, sleep }),
    ).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('asks again with pauses until the webhook is in', async () => {
    sleep.mockClear();
    const check = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(true);
    await expect(
      waitForSubscription(check, { attempts: 10, intervalMs: 1500, sleep }),
    ).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1500);
  });

  it('gives up after the last attempt', async () => {
    const check = vi.fn(() => Promise.resolve(false));
    await expect(
      waitForSubscription(check, { attempts: 10, intervalMs: 1500, sleep }),
    ).resolves.toBe(false);
    expect(check).toHaveBeenCalledTimes(10);
  });

  it('stops when the screen is closed', async () => {
    let closed = false;
    const check = vi.fn(() => {
      closed = true;
      return Promise.resolve(false);
    });
    await expect(
      waitForSubscription(check, {
        attempts: 10,
        intervalMs: 1500,
        sleep,
        cancelled: () => closed,
      }),
    ).resolves.toBe(false);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('waits with real timers by default', async () => {
    vi.useFakeTimers();
    try {
      const check = vi
        .fn<() => Promise<boolean>>()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      const result = waitForSubscription(check, { attempts: 3, intervalMs: 1500 });
      await vi.advanceTimersByTimeAsync(1500);
      await expect(result).resolves.toBe(true);
      expect(check).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
