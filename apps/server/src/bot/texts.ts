/**
 * Texts of the bot (decision 0020). Messages are sent as plain text (no `parse_mode`), so user
 * names need no escaping.
 */

/** The web_app button under `/start` and the chat menu button. */
export const OPEN_BUTTON = 'Открыть';

/** `/start` without an invitation, and the answer to any other text. */
export const START_TEXT =
  'Привет! Здесь вы готовите ужины из кухонь разных стран и собираете штампы в паспорт. ' +
  'Откройте приложение — подберём ужин на сегодня.';

/** `/start <code>` with someone else's valid invite code. */
export const inviteText = (inviterName: string): string =>
  `${inviterName} зовёт вас в «Вокруг света за 80 ужинов». ` +
  'Вы уже друзья в рейтинге — готовьте и соревнуйтесь!';

/** Commands of the bot menu (`setMyCommands`). */
export const BOT_COMMANDS = [
  { command: 'start', description: 'Открыть приложение' },
  { command: 'terms', description: 'Условия использования' },
  { command: 'paysupport', description: 'Помощь с оплатой' },
] as const;

/** Pages of the documents (`TERMS_URL`, `PRIVACY_URL`); `null` until they are published. */
export interface DocumentLinks {
  termsUrl: string | null;
  privacyUrl: string | null;
}

/** `/terms`: links to the published documents, or a placeholder while there are none. */
export function termsText({ termsUrl, privacyUrl }: DocumentLinks): string {
  const lines = [
    ...(termsUrl === null ? [] : [`Условия использования: ${termsUrl}`]),
    ...(privacyUrl === null ? [] : [`Политика конфиденциальности: ${privacyUrl}`]),
  ];
  return lines.length > 0 ? lines.join('\n') : 'Условия использования появятся до запуска оплаты.';
}

/** `/paysupport`: the support contact (`SUPPORT_CONTACT`), or a placeholder while it is unknown. */
export function paySupportText(contact: string | null): string {
  return contact === null
    ? 'Контакт поддержки по оплате появится до запуска оплаты.'
    : `По вопросам оплаты напишите ${contact} — ответим и при необходимости вернём Stars.`;
}

/** Invoice of a plan (`createInvoiceLink`): title ≤ 32 and description ≤ 255 characters. */
export const INVOICE_TEXTS = {
  month: {
    title: 'Подписка на месяц',
    description:
      'Все страны «Вокруг света за 80 ужинов». Продлевается каждые 30 дней, отключить можно в настройках Telegram.',
  },
  year: {
    title: 'Подписка на год',
    description:
      'Все страны «Вокруг света за 80 ужинов» на 365 дней. Разовый платёж без автопродления.',
  },
} as const;

/** Why `pre_checkout_query` is refused; Telegram shows the text to the payer. */
export const CHECKOUT_REFUSAL_TEXTS = {
  stale: 'Счёт устарел. Откройте оплату в приложении ещё раз.',
  other_user: 'Этот счёт выставлен другому пользователю. Откройте оплату в приложении.',
  already_subscribed: 'Подписка уже оформлена.',
} as const;
