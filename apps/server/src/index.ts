import { buildApp } from './app.ts';
import { botToken, mediaUrl } from './config.ts';
import { connect } from './db/client.ts';

const port = Number(process.env.PORT ?? 3080);
const host = process.env.HOST ?? '127.0.0.1';

const { db, pool } = connect();
const app = buildApp({ db, botToken: botToken(), mediaUrl: mediaUrl() }, { logger: true });
app.addHook('onClose', () => pool.end());

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
