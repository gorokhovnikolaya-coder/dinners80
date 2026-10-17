import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { Api, type Transformer } from 'grammy';

import { registerAuth } from './auth/plugin.ts';
import { createBot, type BotSettings } from './bot/bot.ts';
import type { Db } from './db/client.ts';
import { registerErrorHandlers } from './http/errors.ts';
import { MediaStorage } from './media/storage.ts';
import { authRoutes } from './routes/auth.ts';
import { botWebhookRoutes } from './routes/botWebhook.ts';
import { cookRoutes } from './routes/cooks.ts';
import type { RouteDeps } from './routes/deps.ts';
import { dishRoutes } from './routes/dishes.ts';
import { friendsRoutes } from './routes/friends.ts';
import { healthRoutes } from './routes/health.ts';
import { homeRoutes } from './routes/home.ts';
import { meRoutes } from './routes/me.ts';
import { paymentRoutes } from './routes/payments.ts';
import { shareRoutes, type ShareLinks } from './routes/share.ts';
import { shoppingRoutes } from './routes/shopping.ts';
import { eventRoutes } from './routes/events.ts';
import { uploadRoutes } from './routes/uploads.ts';

export interface AppDeps {
  db: Db;
  /** Token of the bot: init data is signed with it. */
  botToken: string;
  /** Public base URL of media files (`MEDIA_URL`); `/media` by default. */
  mediaUrl?: string;
  /** Folder of uploaded files (`MEDIA_DIR`) with `cooks/` and `share/` inside. */
  mediaDir: string;
  /** Secret of the signed links to private photos (`MEDIA_SIGNING_KEY`). */
  mediaSigningKey: string;
  /**
   * The bot behind `POST /api/bot/webhook`; without it (no `WEBAPP_URL`) the webhook is not
   * registered.
   */
  bot?: BotSettings;
  /**
   * `WEBAPP_URL` and `MINI_APP_LINK` for the share message of a stamp; without them
   * `POST /api/share/stamp/:cookId` answers `503 unavailable` (decision 0022).
   */
  shareLinks?: ShareLinks | null;
  /** Bot API call transformer of the API routes: tests intercept `createInvoiceLink` and
   * `savePreparedInlineMessage` with it. */
  apiTransformer?: Transformer;
  /** Current time; injected in tests. */
  now?: () => Date;
}

export function buildApp(deps: AppDeps, options: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify(options);
  const now = deps.now ?? (() => new Date());
  const routeDeps: RouteDeps = {
    db: deps.db,
    now,
    mediaUrl: deps.mediaUrl ?? '/media',
    media: new MediaStorage(deps.mediaDir),
    mediaSigningKey: deps.mediaSigningKey,
  };
  registerErrorHandlers(app);
  // The auth hook goes first: every route below is authenticated unless it opts out.
  registerAuth(app, { db: deps.db, botToken: deps.botToken, now });
  healthRoutes(app);
  authRoutes(app, { db: deps.db, now });
  meRoutes(app, routeDeps);
  homeRoutes(app, routeDeps);
  dishRoutes(app, routeDeps);
  cookRoutes(app, routeDeps);
  friendsRoutes(app, routeDeps);
  shoppingRoutes(app, routeDeps);
  uploadRoutes(app, routeDeps);
  eventRoutes(app, routeDeps);
  const botApi = new Api(deps.botToken);
  if (deps.apiTransformer) botApi.config.use(deps.apiTransformer);
  paymentRoutes(app, { ...routeDeps, botApi });
  shareRoutes(app, { ...routeDeps, botApi, shareLinks: deps.shareLinks ?? null });
  if (deps.bot) {
    const bot = createBot({
      ...deps.bot,
      db: deps.db,
      token: deps.botToken,
      now,
      log: (message, details) => {
        app.log.error(details, message);
      },
    });
    botWebhookRoutes(app, { bot, botToken: deps.botToken });
  }
  return app;
}
