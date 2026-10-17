import { describe, expect, it } from 'vitest';
import { z } from 'zod/mini';

import {
  EVENTS_BATCH_MAX,
  appOpenSource,
  eventsRequestSchema,
  withAppOpenLabel,
  type ClientEvent,
} from './events.ts';

describe('appOpenSource', () => {
  it('treats any start_param as an invite', () => {
    expect(appOpenSource('inv1002', null)).toBe('invite');
    expect(appOpenSource('inv1002', 'menu')).toBe('invite');
  });

  it('takes the launch label of the bot buttons', () => {
    expect(appOpenSource(null, 'menu')).toBe('menu');
    expect(appOpenSource(undefined, 'reminder')).toBe('reminder');
    expect(appOpenSource('', 'reminder')).toBe('reminder');
  });

  it('falls back to the direct link', () => {
    expect(appOpenSource(null, null)).toBe('link');
    expect(appOpenSource(null, 'other')).toBe('link');
  });
});

describe('withAppOpenLabel', () => {
  it('adds the label and keeps the query', () => {
    expect(withAppOpenLabel('https://example.com/app', 'reminder')).toBe(
      'https://example.com/app?from=reminder',
    );
    expect(withAppOpenLabel('https://example.com/app/?a=1', 'menu')).toBe(
      'https://example.com/app/?a=1&from=menu',
    );
    expect(withAppOpenLabel('https://example.com/app#x', 'menu')).toBe(
      'https://example.com/app?from=menu#x',
    );
  });
});

describe('eventsRequestSchema', () => {
  const all: ClientEvent[] = [
    { name: 'app_open', props: { source: 'menu' } },
    {
      name: 'onboarding_done',
      props: {
        household: 'couple',
        weekday_minutes: 30,
        exclusions: ['meat'],
        custom_exclusions: 1,
      },
    },
    { name: 'suggestions_shown', props: { mode: 'weekday', page: 0, dish_ids: ['a', 'b', 'c'] } },
    { name: 'dish_opened', props: { dish_id: 'a', position: 1, from: 'suggestions' } },
    { name: 'dish_opened', props: { dish_id: 'a', position: null, from: 'map' } },
    { name: 'cook_started', props: { dish_id: 'a', servings: 2 } },
    { name: 'share_clicked', props: { channel: 'story' } },
    { name: 'shopping_added', props: { dish_id: 'a', items: 5 } },
    { name: 'paywall_shown', props: { reason: 'country_11' } },
    { name: 'reminder_toggled', props: { enabled: true, time: '18:30' } },
  ];

  it('accepts every client event', () => {
    expect(z.safeParse(eventsRequestSchema, { events: all }).success).toBe(true);
  });

  it('rejects server-only and unknown events, wrong props and extra keys are dropped', () => {
    for (const name of ['payment_success', 'invite_joined', 'cook_finished', 'nope']) {
      expect(z.safeParse(eventsRequestSchema, { events: [{ name, props: {} }] }).success).toBe(
        false,
      );
    }
    expect(
      z.safeParse(eventsRequestSchema, {
        events: [{ name: 'cook_started', props: { dish_id: 'a', servings: 0 } }],
      }).success,
    ).toBe(false);
    const parsed = z.parse(eventsRequestSchema, {
      events: [{ name: 'app_open', props: { source: 'link', extra: 'x' } }],
    });
    expect(parsed.events[0]?.props).toEqual({ source: 'link' });
  });

  it('limits the batch size', () => {
    const event = { name: 'app_open', props: { source: 'menu' } };
    expect(z.safeParse(eventsRequestSchema, { events: [] }).success).toBe(false);
    expect(
      z.safeParse(eventsRequestSchema, { events: Array(EVENTS_BATCH_MAX).fill(event) }).success,
    ).toBe(true);
    expect(
      z.safeParse(eventsRequestSchema, { events: Array(EVENTS_BATCH_MAX + 1).fill(event) }).success,
    ).toBe(false);
  });
});
