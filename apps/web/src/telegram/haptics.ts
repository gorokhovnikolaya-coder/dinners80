import { hapticFeedback } from '@tma.js/sdk-react';

/** Vibration pattern of a finished timer where Telegram haptics are not available, in ms. */
const ALARM_PATTERN = [300, 150, 300, 150, 300];

/** A light tap when a cooking step is completed (ТЗ: haptics on a finished step). */
export function hapticStepDone(): void {
  try {
    hapticFeedback.impactOccurred.ifAvailable('medium');
  } catch {
    // Outside Telegram: no haptics.
  }
}

/**
 * Vibration of a finished timer: the Telegram «warning» notification haptic; where the client
 * cannot do it, the browser Vibration API (Android WebView; iOS has none).
 */
export function vibrateAlarm(): void {
  let done = false;
  try {
    done = hapticFeedback.notificationOccurred.ifAvailable('warning').ok;
  } catch {
    done = false;
  }
  if (!done && typeof navigator.vibrate === 'function') navigator.vibrate(ALARM_PATTERN);
}
