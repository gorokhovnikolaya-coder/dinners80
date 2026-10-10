/**
 * Step timers of the cooking mode. A running timer stores the moment it ends, not the seconds
 * left, so it keeps the right time while the app is in the background or on another screen.
 */
export type StepTimer =
  | { status: 'running'; endsAt: number }
  | { status: 'paused'; remainingMs: number }
  | { status: 'done' };

/** Milliseconds left at `now`; a timer that is not started has its full duration. */
export function remainingMs(timer: StepTimer | undefined, durationMs: number, now: number): number {
  if (!timer) return durationMs;
  switch (timer.status) {
    case 'running':
      return Math.max(0, timer.endsAt - now);
    case 'paused':
      return timer.remainingMs;
    case 'done':
      return 0;
  }
}

/** True if a running timer has reached its end at `now`. */
export const isOverdue = (timer: StepTimer | undefined, now: number): boolean =>
  timer?.status === 'running' && timer.endsAt <= now;

/** Starts a timer, resumes a paused one; a finished one starts over. */
export function startTimer(
  timer: StepTimer | undefined,
  durationMs: number,
  now: number,
): StepTimer {
  const left = timer?.status === 'paused' ? timer.remainingMs : durationMs;
  return { status: 'running', endsAt: now + left };
}

/** Pauses a running timer with the time left; other timers stay as they are. */
export function pauseTimer(timer: StepTimer, now: number): StepTimer {
  return timer.status === 'running'
    ? { status: 'paused', remainingMs: Math.max(0, timer.endsAt - now) }
    : timer;
}

/** «3:00», «12:05», «1:30:00»: whole seconds, rounded up (a timer never shows 0:00 early). */
export function formatTimer(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${String(hours)}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${String(minutes)}:${seconds}`;
}
