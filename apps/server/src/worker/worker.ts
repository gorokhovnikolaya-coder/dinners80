import type { Api } from 'grammy';

import type { Db } from '../db/client.ts';
import type { MediaStorage } from '../media/storage.ts';
import type { WorkerLog } from './log.ts';
import { sendDueReminders } from './reminders.ts';
import { cleanShareCards } from './shareCleanup.ts';

/** Reminders are checked every minute: `reminder_time` has a 30-minute step. */
export const REMINDER_TICK_MS = 60 * 1000;
/** Old share cards are deleted at start and then once a day. */
export const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface WorkerDeps {
  db: Db;
  api: Api;
  media: MediaStorage;
  mediaUrl: string;
  /** `WEBAPP_URL`; `null` — reminders are off (no button to open the mini app), cleanup still runs. */
  webAppUrl: string | null;
  now: () => Date;
  log: WorkerLog;
}

export interface Worker {
  /** Stops the timers and waits for the running job. */
  stop: () => Promise<void>;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * The worker process (ТЗ, «Стек и архитектура»): dinner reminders every minute and the cleanup of
 * old share cards once a day. Jobs never overlap; an error is logged and the schedule goes on.
 */
export function startWorker(deps: WorkerDeps): Worker {
  let running: Promise<void> = Promise.resolve();
  let stopped = false;
  let lastCleanup = -Infinity;

  const tick = async () => {
    const now = deps.now().getTime();
    if (now - lastCleanup >= CLEANUP_INTERVAL_MS) {
      lastCleanup = now;
      try {
        const deleted = await cleanShareCards(deps);
        deps.log.info('share cards cleaned', { deleted });
      } catch (error) {
        deps.log.error('share cleanup failed', { error: String(error) });
      }
    }
    if (deps.webAppUrl === null || stopped) return;
    try {
      const result = await sendDueReminders({ ...deps, webAppUrl: deps.webAppUrl, sleep });
      if (result.sent + result.blocked + result.failed > 0)
        deps.log.info('reminders', { ...result });
    } catch (error) {
      deps.log.error('reminders failed', { error: String(error) });
    }
  };

  let timer: NodeJS.Timeout | undefined;
  const schedule = () => {
    if (stopped) return;
    // On the minute (plus a second), so a reminder goes out at its time.
    const delay = REMINDER_TICK_MS - (Date.now() % REMINDER_TICK_MS) + 1000;
    timer = setTimeout(() => {
      running = tick().finally(schedule);
    }, delay);
  };
  running = tick().finally(schedule);

  return {
    stop: async () => {
      stopped = true;
      clearTimeout(timer);
      await running;
    },
  };
}
