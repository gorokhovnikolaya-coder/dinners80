import { z } from 'zod/mini';

import { DISH_TAGS, HOUSEHOLDS, SERVINGS_MAX, SERVINGS_MIN, WEEKDAY_MINUTES } from './constants.ts';
import { reminderTimeSchema } from './user.ts';
import { SUGGESTION_MODES } from './suggestions.ts';

/** Where the mini app was opened from (`app_open.source`, decision 0024). */
export const APP_OPEN_SOURCES = ['menu', 'link', 'invite', 'reminder'] as const;
export type AppOpenSource = (typeof APP_OPEN_SOURCES)[number];

/**
 * The launch label in the query of the mini app URL: the bot's buttons open `WEBAPP_URL?from=menu`,
 * the reminder — `WEBAPP_URL?from=reminder` (decision 0024).
 */
export const APP_OPEN_PARAM = 'from';

/** Where a dish card was opened from (`dish_opened.from`, decision 0024). */
export const DISH_OPEN_SOURCES = ['suggestions', 'map'] as const;

/** Why the paywall was shown (`paywall_shown.reason`): a locked (11th+) country or the profile. */
export const PAYWALL_REASONS = ['country_11', 'profile'] as const;
export type PaywallReason = (typeof PAYWALL_REASONS)[number];

/** Channel of the stamp sharing (`share_clicked.channel`). */
export const SHARE_CHANNELS = ['story', 'chat'] as const;

/** Most events in one `POST /api/events` batch. */
export const EVENTS_BATCH_MAX = 50;

const dishId = z.string().check(z.minLength(1), z.maxLength(100));

/**
 * The events the client sends (ТЗ, «Аналитика»). The server writes `cook_finished`,
 * `invite_joined` and `payment_success` itself, so they are not accepted here.
 */
export const clientEventSchema = z.discriminatedUnion('name', [
  z.object({
    name: z.literal('app_open'),
    props: z.object({ source: z.enum(APP_OPEN_SOURCES) }),
  }),
  z.object({
    name: z.literal('onboarding_done'),
    props: z.object({
      household: z.enum(HOUSEHOLDS),
      weekday_minutes: z.literal(WEEKDAY_MINUTES),
      exclusions: z.array(z.enum(DISH_TAGS)).check(z.maxLength(DISH_TAGS.length)),
      /** Only the number of the user's own words: the words themselves are not collected. */
      custom_exclusions: z.int().check(z.nonnegative(), z.lte(100)),
    }),
  }),
  z.object({
    name: z.literal('suggestions_shown'),
    props: z.object({
      mode: z.enum(SUGGESTION_MODES),
      page: z.int().check(z.nonnegative()),
      dish_ids: z.array(dishId).check(z.maxLength(10)),
    }),
  }),
  z.object({
    name: z.literal('dish_opened'),
    props: z.object({
      dish_id: dishId,
      /** 1-based position on the shown page of suggestions; `null` outside of them. */
      position: z.nullable(z.int().check(z.positive(), z.lte(100))),
      from: z.enum(DISH_OPEN_SOURCES),
    }),
  }),
  z.object({
    name: z.literal('cook_started'),
    props: z.object({
      dish_id: dishId,
      servings: z.int().check(z.gte(SERVINGS_MIN), z.lte(SERVINGS_MAX)),
    }),
  }),
  z.object({
    name: z.literal('share_clicked'),
    props: z.object({ channel: z.enum(SHARE_CHANNELS) }),
  }),
  z.object({
    name: z.literal('shopping_added'),
    props: z.object({ dish_id: dishId, items: z.int().check(z.positive(), z.lte(200)) }),
  }),
  z.object({
    name: z.literal('paywall_shown'),
    props: z.object({ reason: z.enum(PAYWALL_REASONS) }),
  }),
  z.object({
    name: z.literal('reminder_toggled'),
    props: z.object({ enabled: z.boolean(), time: reminderTimeSchema }),
  }),
]);
export type ClientEvent = z.infer<typeof clientEventSchema>;
export type ClientEventName = ClientEvent['name'];

/** Body of `POST /api/events`: a batch of events in the order they happened. */
export const eventsRequestSchema = z.object({
  events: z.array(clientEventSchema).check(z.minLength(1), z.maxLength(EVENTS_BATCH_MAX)),
});
export type EventsRequest = z.infer<typeof eventsRequestSchema>;

/** Response of `POST /api/events`: how many events were stored. */
export const eventsResponseSchema = z.object({ stored: z.int().check(z.nonnegative()) });
export type EventsResponse = z.infer<typeof eventsResponseSchema>;

/**
 * Source of `app_open` (decision 0024): a `start_param` (any `startapp`, even an unknown code) —
 * `invite`; else the launch label `?from=` of the bot's buttons — `menu` or `reminder`; else the
 * direct link `t.me/<bot>/<app>` — `link`.
 */
export function appOpenSource(
  startParam: string | null | undefined,
  from: string | null,
): AppOpenSource {
  if (startParam) return 'invite';
  if (from === 'menu' || from === 'reminder') return from;
  return 'link';
}

/**
 * The mini app URL with the launch label `?from=` (keeps the URL's own query and hash; the shared
 * package has no `URL`). `WEBAPP_URL` is not expected to carry a label already.
 */
export function withAppOpenLabel(appUrl: string, source: 'menu' | 'reminder'): string {
  const hashAt = appUrl.indexOf('#');
  const head = hashAt === -1 ? appUrl : appUrl.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : appUrl.slice(hashAt);
  const separator = head.includes('?')
    ? head.endsWith('?') || head.endsWith('&')
      ? ''
      : '&'
    : '?';
  return `${head}${separator}${APP_OPEN_PARAM}=${source}${hash}`;
}
