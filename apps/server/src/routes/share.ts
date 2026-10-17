import type { FastifyInstance } from 'fastify';
import { GrammyError, HttpError, type Api } from 'grammy';
import { z } from 'zod/mini';

import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  absoluteMediaUrl,
  miniAppInviteLink,
  type ShareStampResponse,
} from '@tma80/shared';

import { requireUser } from '../auth/plugin.ts';
import { OPEN_BUTTON, shareMessageCaption } from '../bot/texts.ts';
import { cookShareInfo } from '../db/cooks.ts';
import { ApiHttpError } from '../http/errors.ts';
import { SHARE_DIR } from '../media/storage.ts';
import type { RouteDeps } from './deps.ts';

/** Where the share message points: both are needed, otherwise the client falls back. */
export interface ShareLinks {
  /** `WEBAPP_URL`: its origin makes the card URL absolute (Telegram fetches the photo). */
  webAppUrl: string;
  /** `MINI_APP_LINK`: `https://t.me/<bot>/<app>` for the invite button. */
  miniAppLink: string;
}

const cookIdSchema = z.object({ cookId: z.uuid() });

/**
 * `POST /share/stamp/:cookId` (ТЗ, «Интеграция с Telegram»; decision 0022): saves a prepared inline
 * message (`savePreparedInlineMessage`) — the uploaded card of the user's own cook with a caption
 * and the «Открыть» button with the user's invite link — and returns its id for `shareMessage`.
 * Private chats and groups only. Without the settings (`WEBAPP_URL`, `MINI_APP_LINK`) or when the
 * Bot API refuses, `503 unavailable`: the client then shares the invite link by `t.me/share/url`.
 */
export function shareRoutes(
  app: FastifyInstance,
  deps: RouteDeps & { botApi: Api; shareLinks: ShareLinks | null },
): void {
  app.post('/api/share/stamp/:cookId', async (request): Promise<ShareStampResponse> => {
    const user = requireUser(request);
    const params = z.safeParse(cookIdSchema, request.params);
    if (!params.success) throw new ApiHttpError(404, 'not_found', 'Cook not found');
    const { cookId } = params.data;
    const info = await cookShareInfo(deps.db, user.id, cookId);
    if (!info) throw new ApiHttpError(404, 'not_found', 'Cook not found');
    if (info.shareCard === null || !(await deps.media.shareCardExists(info.shareCard)))
      throw new ApiHttpError(400, 'validation', 'Upload the share card first');
    const links = deps.shareLinks;
    if (links === null)
      throw new ApiHttpError(503, 'unavailable', 'Share messages are not configured');

    const photoUrl = absoluteMediaUrl(
      `${deps.mediaUrl}/${SHARE_DIR}/${info.shareCard}`,
      links.webAppUrl,
    );
    try {
      const prepared = await deps.botApi.savePreparedInlineMessage(
        user.tgId,
        {
          type: 'photo',
          id: cookId,
          photo_url: photoUrl,
          thumbnail_url: photoUrl,
          photo_width: SHARE_CARD_WIDTH,
          photo_height: SHARE_CARD_HEIGHT,
          caption: shareMessageCaption(info),
          reply_markup: {
            inline_keyboard: [
              [{ text: OPEN_BUTTON, url: miniAppInviteLink(links.miniAppLink, user.inviteCode) }],
            ],
          },
        },
        { allow_user_chats: true, allow_group_chats: true },
      );
      return { preparedMessageId: prepared.id };
    } catch (error) {
      if (error instanceof GrammyError || error instanceof HttpError) {
        request.log.warn({ name: error.name, message: error.message }, 'share message refused');
        throw new ApiHttpError(503, 'unavailable', 'The share message cannot be prepared');
      }
      throw error;
    }
  });
}
