import { connect } from '../db/client.ts';
import {
  formatMetricsReport,
  METRICS_USAGE,
  MetricsArgsError,
  parseMetricsArgs,
  queryMetrics,
} from './metrics.ts';

// `npm run metrics -- --from 2026-11-01 --to 2026-11-15 --exclude 123,456` (decision 0025).
const now = new Date();
let params;
try {
  params = parseMetricsArgs(process.argv.slice(2), now);
} catch (error) {
  if (!(error instanceof MetricsArgsError)) throw error;
  console.error(`${error.message}\n${METRICS_USAGE}`);
  process.exit(1);
}

const { pool } = connect();
try {
  console.log(formatMetricsReport(params, await queryMetrics(pool, params, now)));
} finally {
  await pool.end();
}
