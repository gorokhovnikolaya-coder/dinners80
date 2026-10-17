import { inArray } from 'drizzle-orm';

import { SHARE_CARD_TTL_DAYS } from '@tma80/shared';

import type { Db } from '../db/client.ts';
import { cooks } from '../db/schema.ts';
import type { MediaStorage } from '../media/storage.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes share cards older than `SHARE_CARD_TTL_DAYS` (ТЗ, «Интеграция с Telegram»; by the file
 * time) and forgets them in `cooks.share_card`: sharing such a cook again uploads a new card.
 * Returns how many cards were deleted.
 */
export async function cleanShareCards(deps: {
  db: Db;
  media: MediaStorage;
  now: () => Date;
}): Promise<number> {
  const deleted = await deps.media.deleteShareCardsBefore(
    new Date(deps.now().getTime() - SHARE_CARD_TTL_DAYS * DAY_MS),
  );
  if (deleted.length > 0)
    await deps.db.update(cooks).set({ shareCard: null }).where(inArray(cooks.shareCard, deleted));
  return deleted.length;
}
