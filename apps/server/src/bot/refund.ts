import { GrammyError, type Api } from 'grammy';

import type { Db } from '../db/client.ts';
import { findPayment, markRefunded } from '../db/payments.ts';

export type RefundResult =
  | { kind: 'not_found' }
  | { kind: 'already_refunded' }
  | { kind: 'refunded'; renewalCancelled: boolean | null };

/**
 * Refund of a payment by the administrator (`npm run payments:refund -- <charge_id>`, decision
 * 0021): for the month first cancels the renewal (`editUserStarSubscription`), so the next period
 * is not charged; then `refundStarPayment` and the status `refunded` — the record stops giving
 * access. Telegram also sends `refunded_payment`, which marks the same record again (idempotent).
 * A charge Telegram has already refunded is only marked.
 * @returns `renewalCancelled` — `null` for the year, `false` if Telegram refused to cancel.
 */
export async function refundPayment(db: Db, api: Api, chargeId: string): Promise<RefundResult> {
  const payment = await findPayment(db, chargeId);
  if (!payment) return { kind: 'not_found' };
  if (payment.status === 'refunded') return { kind: 'already_refunded' };

  let renewalCancelled: boolean | null = null;
  if (payment.plan === 'month') {
    try {
      await api.editUserStarSubscription(payment.tgId, chargeId, true);
      renewalCancelled = true;
    } catch (error) {
      if (!(error instanceof GrammyError)) throw error;
      renewalCancelled = false;
    }
  }
  try {
    await api.refundStarPayment(payment.tgId, chargeId);
  } catch (error) {
    if (!(error instanceof GrammyError && error.description.includes('CHARGE_ALREADY_REFUNDED'))) {
      throw error;
    }
  }
  await markRefunded(db, chargeId);
  return { kind: 'refunded', renewalCancelled };
}
