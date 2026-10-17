import { z } from 'zod/mini';

/** Size of the share card, px: a 9:16 picture for a Telegram story (ТЗ, экран 4). */
export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;

/** Longest story caption of a regular (non-Premium) user (`shareToStory`, `text`). */
export const STORY_TEXT_MAX = 200;

/** Longest name of the story widget link (`shareToStory`, `widget_link.name`). */
export const STORY_WIDGET_NAME_MAX = 48;

/** Longest caption of a photo message (`InlineQueryResultPhoto.caption`). */
export const SHARE_MESSAGE_CAPTION_MAX = 1024;

/**
 * Query of `POST /api/uploads/share-card?cookId=<uuid>`: one card per cook (decision 0022) — the
 * server stores the card of the user's own cook and answers the same URL for a repeated upload.
 */
export const uploadShareCardQuerySchema = z.object({
  cookId: z.uuid(),
});
export type UploadShareCardQuery = z.infer<typeof uploadShareCardQuerySchema>;

/**
 * Response of `POST /api/share/stamp/:cookId`: the id of the prepared inline message
 * (`savePreparedInlineMessage`) with the card of the cook, for the Mini Apps `shareMessage`.
 */
export const shareStampResponseSchema = z.object({
  preparedMessageId: z.string().check(z.minLength(1)),
});
export type ShareStampResponse = z.infer<typeof shareStampResponseSchema>;

/**
 * An absolute URL of a media file for Telegram (`shareToStory` and `InlineQueryResultPhoto` need
 * a public https URL): a relative `MEDIA_URL` (`/media/share/…`) is resolved against the origin
 * of our domain; an absolute one is kept.
 */
export function absoluteMediaUrl(url: string, origin: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = /^https?:\/\/[^/?#]+/i.exec(origin)?.[0];
  if (base === undefined) throw new Error('An http(s) origin is expected');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * The direct link that opens the mini app with the invite code (`startapp`):
 * `https://t.me/<bot>/<app>?startapp=<code>`.
 * @param appLink - `https://t.me/<bot>/<app>` without a query (the shared package has no `URL`).
 */
export function miniAppInviteLink(appLink: string, inviteCode: string): string {
  return `${appLink}?startapp=${encodeURIComponent(inviteCode)}`;
}
