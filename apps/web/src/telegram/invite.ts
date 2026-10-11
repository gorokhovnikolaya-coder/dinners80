import { shareURL } from '@tma.js/sdk-react';

/**
 * Username of the bot and short name of the mini app for the invite link
 * `https://t.me/<bot>/<app>?startapp=<code>`. They are an open question of the ТЗ, so they come
 * from the build environment; the defaults are dev placeholders (decision 0012).
 */
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME ?? 'tma80_dev_bot';
const APP_SHORT_NAME = import.meta.env.VITE_APP_SHORT_NAME ?? 'app';

/** The direct link that opens the mini app with the user's invite code (`startapp`). */
export function inviteLink(inviteCode: string): string {
  const url = new URL(
    `https://t.me/${encodeURIComponent(BOT_USERNAME)}/${encodeURIComponent(APP_SHORT_NAME)}`,
  );
  url.searchParams.set('startapp', inviteCode);
  return url.toString();
}

/** Telegram's share link: the chat picker with the URL and the text (`t.me/share/url`). */
export function shareLink(url: string, text: string): string {
  return `https://t.me/share/url?${new URLSearchParams({ url, text }).toString().replace(/\+/g, '%20')}`;
}

/**
 * Sends the invite link to a chat the user picks: `shareURL` of the SDK (`openTelegramLink` to
 * `t.me/share/url`); outside Telegram or in a client without it — the same link in a new tab.
 */
export function shareInvite(inviteCode: string, text: string): void {
  const link = inviteLink(inviteCode);
  let shared = false;
  try {
    shared = shareURL.ifAvailable(link, text).ok;
  } catch {
    shared = false;
  }
  if (!shared) window.open(shareLink(link, text), '_blank', 'noopener');
}
