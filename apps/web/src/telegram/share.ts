import { shareMessage, shareStory } from '@tma.js/sdk-react';

import { getRawInitData } from './sdk.ts';

/** True if the client can open the story editor (`shareToStory`, Mini Apps 7.8+, mobile only). */
export function canShareStory(): boolean {
  try {
    return shareStory.isAvailable();
  } catch {
    return false;
  }
}

/** True if the client can share a prepared inline message (`shareMessage`, Mini Apps 8.0+). */
export function canShareMessage(): boolean {
  try {
    return shareMessage.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Whether the user has Telegram Premium (`is_premium` of the initData user): only Premium users may
 * post a story with a link widget, so the widget is passed only to them.
 */
export function isPremiumUser(initData: string | undefined = getRawInitData()): boolean {
  const raw = initData === undefined ? null : new URLSearchParams(initData).get('user');
  if (!raw) return false;
  try {
    const user: unknown = JSON.parse(raw);
    return typeof user === 'object' && user !== null && 'is_premium' in user
      ? user.is_premium === true
      : false;
  } catch {
    return false;
  }
}

export interface StoryShare {
  /** Public https URL of the card. */
  mediaUrl: string;
  /** Caption, at most `STORY_TEXT_MAX` characters (the limit of a regular user). */
  text: string;
  /** The link widget: added only for Premium users. */
  link: { url: string; name: string };
}

/**
 * Opens the Telegram story editor with the card (`shareToStory`). The caption carries the invite
 * link for everyone; the link widget is added only for Premium users.
 * @returns `false` if the client could not open the editor.
 */
export function shareCardToStory({ mediaUrl, text, link }: StoryShare): boolean {
  try {
    shareStory(mediaUrl, { text, ...(isPremiumUser() ? { widgetLink: link } : {}) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens the Telegram dialog sharing the prepared message (`shareMessage`).
 * @returns `true` if the message was sent; `false` if the user closed the dialog or it failed.
 */
export async function sendPreparedMessage(id: string): Promise<boolean> {
  try {
    await shareMessage(id);
    return true;
  } catch {
    return false;
  }
}
