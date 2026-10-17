import { Api } from 'grammy';

import { botToken } from '../config.ts';
import { connect } from '../db/client.ts';
import { refundPayment } from './refund.ts';

/**
 * `npm run payments:refund -- <telegram_payment_charge_id>`: a refund by the administrator (run by
 * a human against the real bot and database).
 */
const chargeId = process.argv[2]?.trim() ?? '';
if (chargeId === '') {
  console.error('Usage: npm run payments:refund -- <telegram_payment_charge_id>');
  process.exit(2);
}

const { db, pool } = connect();
try {
  const result = await refundPayment(db, new Api(botToken()), chargeId);
  switch (result.kind) {
    case 'not_found':
      console.error(`No payment ${chargeId}`);
      process.exitCode = 1;
      break;
    case 'already_refunded':
      console.info(`Payment ${chargeId} is already refunded`);
      break;
    case 'refunded':
      console.info(`Payment ${chargeId} is refunded`);
      if (result.renewalCancelled === false) {
        console.warn('Telegram refused to cancel the renewal: check the subscription manually');
      }
      break;
  }
} finally {
  await pool.end();
}
