import { requestWriteAccess } from '@tma.js/sdk-react';

/**
 * True if this client can ask the user to let the bot write (`requestWriteAccess`, Mini Apps 6.9+).
 * Older clients and the browser outside Telegram cannot: the profile then asks to update Telegram.
 */
export function canRequestWriteAccess(): boolean {
  try {
    return requestWriteAccess.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Shows the Telegram popup asking to let the bot send messages to the user.
 * @returns `true` if the user allowed it; `false` if they declined, the client cannot ask, or the
 *   request failed — the reminder then stays off.
 */
export async function askWriteAccess(): Promise<boolean> {
  if (!canRequestWriteAccess()) return false;
  try {
    return (await requestWriteAccess()) === 'allowed';
  } catch {
    return false;
  }
}
