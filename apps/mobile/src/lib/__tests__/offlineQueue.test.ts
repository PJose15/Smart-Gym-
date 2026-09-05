/**
 * Offline queue — TTL expiry and permanent-failure (poison pill) handling.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  enqueueEvent,
  flushQueue,
  getQueueSize,
  clearQueue,
  QUEUE_TTL_MS,
  type QueuedItem,
} from '../offlineQueue';

const QUEUE_KEY = '@nexera/offline_queue';

async function seedQueue(items: QueuedItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

function item(overrides: Partial<QueuedItem> = {}): QueuedItem {
  return {
    table: 'app_events',
    payload: { event_name: 'test' },
    queuedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(async () => {
  await clearQueue();
});

describe('flushQueue', () => {
  test('replays and removes successful items', async () => {
    await enqueueEvent('app_events', { event_name: 'a' });
    await enqueueEvent('app_events', { event_name: 'b' });

    const result = await flushQueue(async () => true);

    expect(result).toEqual({ flushed: 2, remaining: 0, dropped: 0 });
    expect(await getQueueSize()).toBe(0);
  });

  test('keeps transient failures queued (false / throw)', async () => {
    await seedQueue([item(), item({ payload: { event_name: 'boom' } })]);

    const result = await flushQueue(async (_t, payload) => {
      if (payload.event_name === 'boom') throw new Error('network');
      return false;
    });

    expect(result).toEqual({ flushed: 0, remaining: 2, dropped: 0 });
    expect(await getQueueSize()).toBe(2);
  });

  test("removes permanent failures ('drop') without retrying", async () => {
    await seedQueue([item({ payload: { event_name: 'poison' } }), item()]);

    const result = await flushQueue(async (_t, payload) =>
      payload.event_name === 'poison' ? 'drop' : true,
    );

    expect(result).toEqual({ flushed: 1, remaining: 0, dropped: 1 });
    expect(await getQueueSize()).toBe(0);
  });

  test('drops items older than the 48h TTL without calling the replay fn', async () => {
    const stale = new Date(Date.now() - QUEUE_TTL_MS - 60_000).toISOString();
    const fresh = new Date().toISOString();
    await seedQueue([
      item({ queuedAt: stale, payload: { event_name: 'old' } }),
      item({ queuedAt: fresh, payload: { event_name: 'new' } }),
    ]);

    const replayed: string[] = [];
    const result = await flushQueue(async (_t, payload) => {
      replayed.push(payload.event_name as string);
      return true;
    });

    expect(replayed).toEqual(['new']);
    expect(result).toEqual({ flushed: 1, remaining: 0, dropped: 1 });
  });

  test('drops items with corrupt timestamps', async () => {
    await seedQueue([item({ queuedAt: 'not-a-date' })]);

    const result = await flushQueue(async () => true);

    expect(result).toEqual({ flushed: 0, remaining: 0, dropped: 1 });
  });

  test('empty queue is a no-op', async () => {
    const fn = jest.fn();
    const result = await flushQueue(fn);
    expect(fn).not.toHaveBeenCalled();
    expect(result).toEqual({ flushed: 0, remaining: 0, dropped: 0 });
  });
});
