import type pg from 'pg';

/**
 * Success metrics of the closed test (ТЗ, «Метрики успеха»; definitions — decision 0025).
 * `npm run metrics -- --from <date> [--to <date>] [--exclude <tg ids>]`.
 */
export interface MetricsParams {
  /** Start of the period, inclusive. */
  from: Date;
  /** End of the period, exclusive. */
  to: Date;
  /** Telegram ids of the team: their accounts, cooks, events and invitations are not counted. */
  excludeTgIds: number[];
}

export class MetricsArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricsArgsError';
  }
}

export const METRICS_USAGE =
  'Usage: npm run metrics -- --from YYYY-MM-DD [--to YYYY-MM-DD] [--exclude <tg_id>,<tg_id>]\n' +
  '  dates without time are midnight in Moscow (UTC+3); --to is exclusive, now by default';

/** A date `YYYY-MM-DD` (midnight in Moscow) or a full ISO timestamp with an offset. */
function parseDate(value: string, name: string): Date {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+03:00` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new MetricsArgsError(`${name}: not a date: ${value}`);
  return date;
}

/** Parses the CLI arguments; `now` is the default end of the period. */
export function parseMetricsArgs(argv: readonly string[], now: Date): MetricsParams {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? '';
    const [flag, inline] = arg.split('=', 2) as [string, string | undefined];
    if (!['--from', '--to', '--exclude'].includes(flag)) {
      throw new MetricsArgsError(`unknown argument: ${arg}`);
    }
    const value = inline ?? argv[(index += 1)];
    if (value === undefined || value === '') throw new MetricsArgsError(`${flag} needs a value`);
    values.set(flag, value);
  }

  const fromValue = values.get('--from');
  if (fromValue === undefined) throw new MetricsArgsError('--from is required');
  const from = parseDate(fromValue, '--from');
  const toValue = values.get('--to');
  const to = toValue === undefined ? now : parseDate(toValue, '--to');
  if (to <= from) throw new MetricsArgsError('--to must be after --from');

  const excludeTgIds = (values.get('--exclude') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '')
    .map((id) => {
      if (!/^\d+$/.test(id)) throw new MetricsArgsError(`--exclude: not a Telegram id: ${id}`);
      return Number(id);
    });
  return { from, to, excludeTgIds };
}

/** Raw counts the metrics are made of. */
export interface MetricsCounts {
  /** Cohort: users who finished onboarding within the period. */
  onboarded: number;
  /** Cohort users with `cook_started` within 7 days after onboarding. */
  startedWithin7Days: number;
  /** Cohort users whose 7-day window after onboarding is not over yet. */
  open7DayWindows: number;
  /** Cohort users with 2+ different dishes cooked within 14 days after sign-up. */
  twoDishesWithin14Days: number;
  /** Cohort users whose 14-day window after sign-up is not over yet. */
  open14DayWindows: number;
  /** `cook_started` / `cook_finished` events within the period. */
  cooksStarted: number;
  cooksFinished: number;
  /** Cooks within the period, all and with a photo. */
  cooks: number;
  cooksWithPhoto: number;
  /** Users with at least one cook within the period. */
  activeUsers: number;
  /** New users of the period who came by an invite of a non-team user. */
  invitedUsers: number;
  /** `payment_success` events within the period (for reference). */
  payments: number;
  /** Users shown the paywall (`paywall_shown`) within the period. */
  paywallUsers: number;
  /** Of them, users with `payment_success` after the first show, before the end of the period. */
  paywallPaidUsers: number;
}

const count = (column: string) => `coalesce(${column}, 0)::int`;

/** One query over `users`, `events` and `cooks`; `now` closes the 7- and 14-day windows. */
export const METRICS_SQL = `
with team as (
  select id from users where tg_id = any($3::bigint[])
),
outside as (
  select id, created_at, onboarded_at, invited_by from users
  where not (tg_id = any($3::bigint[]))
),
cohort as (
  select * from outside where onboarded_at >= $1 and onboarded_at < $2
),
period_events as (
  select e.name from events e join outside u on u.id = e.user_id
  where e.created_at >= $1 and e.created_at < $2
),
paywall_users as (
  select e.user_id, min(e.created_at) as first_shown
  from events e join outside u on u.id = e.user_id
  where e.name = 'paywall_shown' and e.created_at >= $1 and e.created_at < $2
  group by e.user_id
),
period_cooks as (
  select k.user_id, k.photo_path from cooks k join outside u on u.id = k.user_id
  where k.created_at >= $1 and k.created_at < $2
)
select
  ${count('(select count(*) from cohort)')} as onboarded,
  ${count(`(select count(*) from cohort c where exists (
    select 1 from events e where e.user_id = c.id and e.name = 'cook_started'
      and e.created_at >= c.onboarded_at and e.created_at < c.onboarded_at + interval '7 days'))`)}
    as started_within_7_days,
  ${count(`(select count(*) from cohort c where c.onboarded_at + interval '7 days' > $4)`)}
    as open_7_day_windows,
  ${count(`(select count(*) from cohort c where (
    select count(distinct k.dish_id) from cooks k
    where k.user_id = c.id and k.created_at < c.created_at + interval '14 days') >= 2)`)}
    as two_dishes_within_14_days,
  ${count(`(select count(*) from cohort c where c.created_at + interval '14 days' > $4)`)}
    as open_14_day_windows,
  ${count(`(select count(*) from period_events where name = 'cook_started')`)} as cooks_started,
  ${count(`(select count(*) from period_events where name = 'cook_finished')`)} as cooks_finished,
  ${count('(select count(*) from period_cooks)')} as cooks,
  ${count('(select count(*) from period_cooks where photo_path is not null)')} as cooks_with_photo,
  ${count('(select count(distinct user_id) from period_cooks)')} as active_users,
  ${count(`(select count(*) from outside u
    where u.created_at >= $1 and u.created_at < $2 and u.invited_by is not null
      and u.invited_by not in (select id from team))`)} as invited_users,
  ${count(`(select count(*) from period_events where name = 'payment_success')`)} as payments,
  ${count('(select count(*) from paywall_users)')} as paywall_users,
  ${count(`(select count(*) from paywall_users p where exists (
    select 1 from events e where e.user_id = p.user_id and e.name = 'payment_success'
      and e.created_at >= p.first_shown and e.created_at < $2))`)} as paywall_paid_users
`;

interface MetricsRow {
  onboarded: number;
  started_within_7_days: number;
  open_7_day_windows: number;
  two_dishes_within_14_days: number;
  open_14_day_windows: number;
  cooks_started: number;
  cooks_finished: number;
  cooks: number;
  cooks_with_photo: number;
  active_users: number;
  invited_users: number;
  payments: number;
  paywall_users: number;
  paywall_paid_users: number;
}

export async function queryMetrics(
  client: pg.Pool | pg.ClientBase,
  params: MetricsParams,
  now: Date,
): Promise<MetricsCounts> {
  const result = await client.query<MetricsRow>(METRICS_SQL, [
    params.from,
    params.to,
    params.excludeTgIds,
    now,
  ]);
  const row = result.rows[0];
  if (row === undefined) throw new Error('metrics query returned no rows');
  return {
    onboarded: row.onboarded,
    startedWithin7Days: row.started_within_7_days,
    open7DayWindows: row.open_7_day_windows,
    twoDishesWithin14Days: row.two_dishes_within_14_days,
    open14DayWindows: row.open_14_day_windows,
    cooksStarted: row.cooks_started,
    cooksFinished: row.cooks_finished,
    cooks: row.cooks,
    cooksWithPhoto: row.cooks_with_photo,
    activeUsers: row.active_users,
    invitedUsers: row.invited_users,
    payments: row.payments,
    paywallUsers: row.paywall_users,
    paywallPaidUsers: row.paywall_paid_users,
  };
}

/** A metric of the report: value, the parts it is made of and the target of ТЗ (if any). */
export interface Metric {
  title: string;
  numerator: number;
  denominator: number;
  /** `null` when the denominator is 0. */
  value: number | null;
  /** Target value; `null` — for reference only. */
  target: number | null;
  /** `percent` — a share, `ratio` — a plain number. */
  kind: 'percent' | 'ratio';
}

const metric = (
  title: string,
  numerator: number,
  denominator: number,
  target: number | null,
  kind: Metric['kind'] = 'percent',
): Metric => ({
  title,
  numerator,
  denominator,
  value: denominator === 0 ? null : numerator / denominator,
  target,
  kind,
});

/** The six metrics of ТЗ in its order, with its targets. */
export function computeMetrics(counts: MetricsCounts): Metric[] {
  return [
    metric(
      'Доля завершивших онбординг, начавших готовить в первые 7 дней',
      counts.startedWithin7Days,
      counts.onboarded,
      0.4,
    ),
    metric(
      'Доля начатых готовок, закончившихся штампом',
      counts.cooksFinished,
      counts.cooksStarted,
      0.6,
    ),
    metric('Доля готовок с фото (справочно)', counts.cooksWithPhoto, counts.cooks, null),
    metric(
      'Доля пользователей с 2+ блюдами за 14 дней',
      counts.twoDishesWithin14Days,
      counts.onboarded,
      0.25,
    ),
    metric(
      'Приглашённых друзей на активного пользователя',
      counts.invitedUsers,
      counts.activeUsers,
      0.3,
      'ratio',
    ),
    metric(
      'Конверсия из показа пейвола в оплату',
      counts.paywallPaidUsers,
      counts.paywallUsers,
      0.05,
    ),
  ];
}

const formatValue = (value: number, kind: Metric['kind']): string =>
  kind === 'percent' ? `${(value * 100).toFixed(1)}%` : value.toFixed(2);

/** Moscow date and time of the report header. */
const formatMoscow = (date: Date): string =>
  new Date(date.getTime() + 3 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');

export function formatMetricsReport(params: MetricsParams, counts: MetricsCounts): string {
  const lines = [
    `Метрики закрытого теста: ${formatMoscow(params.from)} — ${formatMoscow(params.to)} (МСК, конец не включён)`,
    `Исключены аккаунты команды: ${params.excludeTgIds.length === 0 ? 'нет' : params.excludeTgIds.join(', ')}`,
    `Завершили онбординг за период: ${String(counts.onboarded)}; активных (есть готовка): ${String(counts.activeUsers)}; оплат: ${String(counts.payments)}`,
    '',
  ];
  for (const item of computeMetrics(counts)) {
    const value = item.value === null ? '—' : formatValue(item.value, item.kind);
    const target =
      item.target === null
        ? ''
        : ` · цель ≥ ${formatValue(item.target, item.kind)}: ${
            item.value === null ? 'нет данных' : item.value >= item.target ? 'да' : 'нет'
          }`;
    lines.push(
      `${item.title}: ${value} (${String(item.numerator)} / ${String(item.denominator)})${target}`,
    );
  }
  const open = [
    counts.open7DayWindows > 0
      ? `у ${String(counts.open7DayWindows)} не прошло 7 дней после онбординга`
      : null,
    counts.open14DayWindows > 0
      ? `у ${String(counts.open14DayWindows)} не прошло 14 дней после регистрации`
      : null,
  ].filter((line) => line !== null);
  if (open.length > 0) {
    lines.push('', `Окна ещё открыты (значения могут вырасти): ${open.join('; ')}`);
  }
  return lines.join('\n');
}
