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
 * Opens the chat picker with the URL and the text: `shareURL` of the SDK (`openTelegramLink` to
 * `t.me/share/url`); outside Telegram or in a client without it — the same link in a new tab.
 */
export function shareToChat(url: string, text: string): void {
  let shared = false;
  try {
    shared = shareURL.ifAvailable(url, text).ok;
  } catch {
    shared = false;
  }
  if (!shared) window.open(shareLink(url, text), '_blank', 'noopener');
}

/** Sends the invite link with the text to a chat the user picks (`shareToChat`). */
export function shareInvite(inviteCode: string, text: string): void {
  shareToChat(inviteLink(inviteCode), text);
}
