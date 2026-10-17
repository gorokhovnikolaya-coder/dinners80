import { describe, expect, it } from 'vitest';

import { startPayload } from './bot.ts';
import { webhookSecret } from './secret.ts';
import { inviteText, paySupportText, termsText } from './texts.ts';

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
