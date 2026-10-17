import { buildApp } from './app.ts';
import {
  botToken,
  documentLinks,
  mediaDir,
  mediaSigningKey,
  mediaUrl,
  miniAppLink,
  supportContact,
  webAppUrl,
} from './config.ts';
import { connect } from './db/client.ts';

const port = Number(process.env.PORT ?? 3080);
const host = process.env.HOST ?? '127.0.0.1';

const { db, pool } = connect();
const appUrl = webAppUrl();
const appLink = miniAppLink();
const app = buildApp(
  {
    db,
    botToken: botToken(),
    mediaUrl: mediaUrl(),
    mediaDir: mediaDir(),
    mediaSigningKey: mediaSigningKey(),
    shareLinks: appUrl === null || appLink === null ? null : { webAppUrl: appUrl, miniAppLink: appLink },
    ...(appUrl === null
      ? {}
      : {
          bot: { webAppUrl: appUrl, ...documentLinks(), supportContact: supportContact() },
        }),
  },
  { logger: true },
);
app.addHook('onClose', () => pool.end());
if (appUrl === null) app.log.warn('WEBAPP_URL is not set: the bot webhook is disabled');
if (appUrl === null || appLink === null)
  app.log.warn('WEBAPP_URL or MINI_APP_LINK is not set: stamps are shared by t.me/share/url');

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
