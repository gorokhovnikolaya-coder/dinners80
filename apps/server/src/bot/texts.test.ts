import { describe, expect, it } from 'vitest';

import { SHARE_MESSAGE_CAPTION_MAX } from '@tma80/shared';

import { startPayload } from './bot.ts';
import { webhookSecret } from './secret.ts';
import { inviteText, paySupportText, shareMessageCaption, termsText } from './texts.ts';

describe('bot texts', () => {
  it('names the inviter', () => {
    expect(inviteText('Маша')).toBe(
      'Маша зовёт вас в «Вокруг света за 80 ужинов». Вы уже друзья в рейтинге — готовьте и соревнуйтесь!',
    );
  });

  it('lists the published documents or shows a placeholder', () => {
    expect(termsText({ termsUrl: null, privacyUrl: null })).toBe(
      'Условия использования появятся до запуска оплаты.',
    );
    expect(termsText({ termsUrl: 'https://a/terms', privacyUrl: null })).toBe(
      'Условия использования: https://a/terms',
    );
    expect(termsText({ termsUrl: 'https://a/terms', privacyUrl: 'https://a/privacy' })).toBe(
      'Условия использования: https://a/terms\nПолитика конфиденциальности: https://a/privacy',
    );
  });

  it('gives the support contact or a placeholder', () => {
    expect(paySupportText('@help')).toBe(
      'По вопросам оплаты напишите @help — ответим и при необходимости вернём Stars.',
    );
    expect(paySupportText(null)).toBe('Контакт поддержки по оплате появится до запуска оплаты.');
  });
});

describe('startPayload', () => {
  it('takes a deep-link code and ignores anything else', () => {
    expect(startPayload('AbC123_-x')).toBe('AbC123_-x');
    expect(startPayload(' inv1002 ')).toBe('inv1002');
    expect(startPayload('')).toBeNull();
    expect(startPayload('two words')).toBeNull();
    expect(startPayload('a'.repeat(65))).toBeNull();
  });
});

describe('webhookSecret', () => {
  it('is stable, token-specific and allowed by Telegram', () => {
    const secret = webhookSecret('1:abc');
    expect(secret).toBe(webhookSecret('1:abc'));
    expect(secret).not.toBe(webhookSecret('1:abd'));
    expect(secret).toMatch(/^[A-Za-z0-9_-]{1,256}$/);
    expect(secret).not.toContain('abc');
  });
});

/**
 * Reference captions of the share message: the server caption (`shareMessageCaption`) and the
 * client fallback text (`ru.cooked.share.messageText`) must stay the same, so both tests check
 * this same table (keep the copies in apps/server/src/bot/texts.test.ts and
 * apps/web/src/screens/cooked/share.test.ts in sync).
 */
const SHARE_CAPTION_CASES = [
  {
    newCountry: true,
    countryName: 'Перу',
    dishTitle: 'Ломо сальтадо',
    countriesCount: 8,
    countriesTotal: 30,
    caption:
      'Перу в паспорте — уже 8 из 30 стран! Готовлю ужины из кухонь разных стран и собираю штампы. Присоединяйся — посоревнуемся!',
  },
  {
    newCountry: true,
    countryName: 'Новая Зеландия',
    dishTitle: 'Павлова',
    countriesCount: 1,
    countriesTotal: 12,
    caption:
      'Новая Зеландия в паспорте — уже 1 из 12 стран! Готовлю ужины из кухонь разных стран и собираю штампы. Присоединяйся — посоревнуемся!',
  },
  {
    newCountry: false,
    countryName: 'Перу',
    dishTitle: 'Ломо сальтадо',
    countriesCount: 8,
    countriesTotal: 30,
    caption:
      'Ломо сальтадо — блюдо засчитано, уже 8 из 30 стран! Готовлю ужины из кухонь разных стран и собираю штампы. Присоединяйся — посоревнуемся!',
  },
  {
    newCountry: false,
    countryName: 'Индия',
    dishTitle: 'Дал из красной чечевицы',
    countriesCount: 30,
    countriesTotal: 30,
    caption:
      'Дал из красной чечевицы — блюдо засчитано, уже 30 из 30 стран! Готовлю ужины из кухонь разных стран и собираю штампы. Присоединяйся — посоревнуемся!',
  },
] as const;

describe('shareMessageCaption', () => {
  it.each(SHARE_CAPTION_CASES)(
    'matches the reference caption: $caption',
    ({ caption, ...share }) => {
      expect(shareMessageCaption(share)).toBe(caption);
    },
  );

  const share = {
    countryName: 'Перу',
    dishTitle: 'Ломо сальтадо',
    countriesCount: 8,
    countriesTotal: 30,
  };

  it('tells about the new country or the counted dish', () => {
    expect(shareMessageCaption({ ...share, newCountry: true })).toBe(
      'Перу в паспорте — уже 8 из 30 стран! Готовлю ужины из кухонь разных стран и собираю ' +
        'штампы. Присоединяйся — посоревнуемся!',
    );
    expect(shareMessageCaption({ ...share, newCountry: false })).toMatch(
      /^Ломо сальтадо — блюдо засчитано, уже 8 из 30 стран! /,
    );
  });

  it('fits a photo caption', () => {
    const long = { ...share, dishTitle: 'Б'.repeat(200), newCountry: false };
    expect(shareMessageCaption(long).length).toBeLessThanOrEqual(SHARE_MESSAGE_CAPTION_MAX);
  });
});
