import { describe, expect, it } from 'vitest';

import {
  computeMetrics,
  formatMetricsReport,
  MetricsArgsError,
  parseMetricsArgs,
  type MetricsCounts,
} from './metrics.ts';

const NOW = new Date('2026-11-20T12:00:00Z');

describe('parseMetricsArgs', () => {
  it('reads dates as Moscow midnight and the team ids', () => {
    expect(
      parseMetricsArgs(['--from', '2026-11-01', '--to=2026-11-15', '--exclude', '1, 22,'], NOW),
    ).toEqual({
      from: new Date('2026-10-31T21:00:00Z'),
      to: new Date('2026-11-14T21:00:00Z'),
      excludeTgIds: [1, 22],
    });
  });

  it('ends the period now by default and accepts full timestamps', () => {
    expect(parseMetricsArgs(['--from', '2026-11-01T10:00:00Z'], NOW)).toEqual({
      from: new Date('2026-11-01T10:00:00Z'),
      to: NOW,
      excludeTgIds: [],
    });
  });

  it.each([
    [[]],
    [['--from']],
    [['--from', 'tomorrow']],
    [['--from', '2026-11-10', '--to', '2026-11-01']],
    [['--from', '2026-11-01', '--exclude', '@me']],
    [['--since', '2026-11-01']],
  ])('rejects %j', (argv) => {
    expect(() => parseMetricsArgs(argv, NOW)).toThrow(MetricsArgsError);
  });
});

const counts: MetricsCounts = {
  onboarded: 40,
  startedWithin7Days: 18,
  open7DayWindows: 0,
  twoDishesWithin14Days: 9,
  open14DayWindows: 3,
  cooksStarted: 50,
  cooksFinished: 31,
  cooks: 31,
  cooksWithPhoto: 12,
  activeUsers: 20,
  invitedUsers: 5,
  payments: 2,
};

describe('computeMetrics', () => {
  it('divides the counts of each metric', () => {
    expect(computeMetrics(counts).map((item) => [item.value, item.target])).toEqual([
      [18 / 40, 0.4],
      [31 / 50, 0.6],
      [12 / 31, null],
      [9 / 40, 0.25],
      [5 / 20, 0.3],
    ]);
  });

  it('has no value without a denominator', () => {
    const empty = computeMetrics({ ...counts, onboarded: 0, cooksStarted: 0 });
    expect(empty[0]?.value).toBeNull();
    expect(empty[1]?.value).toBeNull();
  });
});

describe('formatMetricsReport', () => {
  it('prints values, parts, targets and open windows', () => {
    const report = formatMetricsReport(
      {
        from: new Date('2026-10-31T21:00:00Z'),
        to: new Date('2026-11-14T21:00:00Z'),
        excludeTgIds: [1],
      },
      counts,
    );
    expect(report).toContain('2026-11-01 00:00 — 2026-11-15 00:00');
    expect(report).toContain('Исключены аккаунты команды: 1');
    expect(report).toContain('в первые 7 дней: 45.0% (18 / 40) · цель ≥ 40.0%: да');
    expect(report).toContain('штампом: 62.0% (31 / 50) · цель ≥ 60.0%: да');
    expect(report).toContain('с фото (справочно): 38.7% (12 / 31)\n');
    expect(report).toContain('за 14 дней: 22.5% (9 / 40) · цель ≥ 25.0%: нет');
    expect(report).toContain('на активного пользователя: 0.25 (5 / 20) · цель ≥ 0.30: нет');
    expect(report).toContain('у 3 не прошло 14 дней после регистрации');
    expect(report).not.toContain('7 дней после онбординга');
  });

  it('marks metrics without data', () => {
    const report = formatMetricsReport(
      { from: NOW, to: NOW, excludeTgIds: [] },
      { ...counts, onboarded: 0 },
    );
    expect(report).toContain('в первые 7 дней: — (18 / 0) · цель ≥ 40.0%: нет данных');
    expect(report).toContain('Исключены аккаунты команды: нет');
  });
});
