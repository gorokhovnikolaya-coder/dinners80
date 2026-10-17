import { Api } from 'grammy';

import { botToken, mediaDir, mediaUrl, webAppUrl } from '../config.ts';
import { connect } from '../db/client.ts';
import { MediaStorage } from '../media/storage.ts';
import { consoleLog } from './log.ts';
import { startWorker } from './worker.ts';

// The worker: a separate Node process of the same code (ТЗ, «Стек и архитектура»; decision 0023).
const { db, pool } = connect();
const appUrl = webAppUrl();
if (appUrl === null) consoleLog.warn('WEBAPP_URL is not set: reminders are off');

const worker = startWorker({
  db,
  api: new Api(botToken()),
  media: new MediaStorage(mediaDir()),
  mediaUrl: mediaUrl(),
  webAppUrl: appUrl,
  now: () => new Date(),
  log: consoleLog,
});
consoleLog.info('worker started');

const shutdown = async () => {
  await worker.stop();
  await pool.end();
  consoleLog.info('worker stopped');
};
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}
