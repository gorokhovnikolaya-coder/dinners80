import { EVENTS_BATCH_MAX, type ClientEvent } from '@tma80/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from './config.ts';
import { FLUSH_DELAY_MS, QUEUE_MAX, flushEvents, resetEventsForTest, track } from './events.ts';

const open: ClientEvent = { name: 'app_open', props: { source: 'menu' } };
const share: ClientEvent = { name: 'share_clicked', props: { channel: 'chat' } };

describe('analytics queue', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  const batches = () =>
    fetchMock.mock.calls.map(([, init]) => {
      const body = init?.body;
      if (typeof body !== 'string') throw new Error('a JSON body is expected');
      return (JSON.parse(body) as { events: ClientEvent[] }).events;
    });

  beforeEach(() => {
    vi.useFakeTimers();
    resetEventsForTest();
    fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('{"stored":1}', { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sends the events in one batch a few seconds after the first one', async () => {
    track(open);
    track(share);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS);
    expect(batches()).toEqual([[open, share]]);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`${API_URL}/events`);
    expect(init).toMatchObject({ method: 'POST', keepalive: true });
  });

  it('sends a full batch at once and splits a long queue', async () => {
    for (let index = 0; index < EVENTS_BATCH_MAX; index += 1) track(open);
    await vi.advanceTimersByTimeAsync(0);
    expect(batches()).toHaveLength(1);
    expect(batches()[0]).toHaveLength(EVENTS_BATCH_MAX);
  });

  it('keeps a batch after a network or server failure and drops a rejected one', async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('offline')));
    track(open);
    await flushEvents();
    track(share);
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response('', { status: 503 })));
    await flushEvents();
    await flushEvents();
    expect(batches()).toEqual([[open], [open, share], [open, share]]);

    fetchMock.mockClear();
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response('', { status: 400 })));
    track(open);
    await flushEvents();
    await flushEvents();
    expect(batches()).toEqual([[open]]);
  });

  it('caps the queue while the server is unreachable', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('offline')));
    for (let index = 0; index < QUEUE_MAX + 10; index += 1)
      track({
        name: 'dish_opened',
        props: { dish_id: `d${String(index)}`, position: null, from: 'map' },
      });
    await vi.advanceTimersByTimeAsync(0);
    fetchMock.mockClear();
    fetchMock.mockImplementation(() => Promise.resolve(new Response('', { status: 200 })));
    await flushEvents();
    const sent = batches().flat();
    expect(sent).toHaveLength(QUEUE_MAX);
    expect(sent[0]).toMatchObject({ props: { dish_id: 'd10' } });
  });
});
