import { openLink } from '@tma.js/sdk-react';

/**
 * Opens an external page (terms, privacy policy) without closing the mini app: Telegram's
 * `openLink`, in Instant View where Telegram can build one. Call it from a user action (Telegram
 * requires it).
 * @returns `true` if Telegram opened the link; `false` outside Telegram or in a client without
 *   the method — then the caller lets the browser follow the link (a new tab).
 */
export function openExternalLink(url: string): boolean {
  try {
    return openLink.ifAvailable(url, { tryInstantView: true }).ok;
  } catch {
    return false;
  }
}
