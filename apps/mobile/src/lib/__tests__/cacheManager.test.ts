import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCached, setCache, clearCache, clearAllCaches, cacheFirst, CacheTTL } from '../cacheManager';

const NOW = new Date('2025-06-15T10:00:00Z').getTime();

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  AsyncStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('setCache + getCached', () => {
  test('stores and retrieves data', async () => {
    await setCache('machinesList', [{ id: '1' }]);
    const result = await getCached('machinesList');
    expect(result).toEqual([{ id: '1' }]);
  });

  test('returns null when key not found', async () => {
    const result = await getCached('machinesList');
    expect(result).toBeNull();
  });

  test('returns null when TTL expired', async () => {
    await setCache('machinesList', [{ id: '1' }]);
    // Advance past machinesList TTL (10 min)
    jest.setSystemTime(NOW + CacheTTL.machinesList + 1);
    const result = await getCached('machinesList');
    expect(result).toBeNull();
  });

  test('returns data within TTL', async () => {
    await setCache('machinesList', [{ id: '1' }]);
    // Advance to just before expiry
    jest.setSystemTime(NOW + CacheTTL.machinesList - 1000);
    const result = await getCached('machinesList');
    expect(result).toEqual([{ id: '1' }]);
  });

  test('custom TTL override', async () => {
    await setCache('custom-key' as any, 'hello');
    // With 1-second custom TTL
    jest.setSystemTime(NOW + 2000);
    const result = await getCached('custom-key' as any, 1000);
    expect(result).toBeNull();
  });

  test('returns null on corrupt JSON', async () => {
    await AsyncStorage.setItem('@nexera/cache/machinesList', 'not-json');
    const result = await getCached('machinesList');
    expect(result).toBeNull();
  });
});

describe('clearCache', () => {
  test('removes specific key', async () => {
    await setCache('machinesList', [1, 2, 3]);
    await setCache('machineDetail', { id: '1' });
    await clearCache('machinesList');

    expect(await getCached('machinesList')).toBeNull();
    expect(await getCached('machineDetail')).toEqual({ id: '1' });
  });
});

describe('clearAllCaches', () => {
  test('removes all @nexera/cache/ keys', async () => {
    await setCache('machinesList', [1]);
    await setCache('machineDetail', { id: '1' });
    await setCache('featureFlags', true);

    await clearAllCaches();

    expect(await getCached('machinesList')).toBeNull();
    expect(await getCached('machineDetail')).toBeNull();
    expect(await getCached('featureFlags')).toBeNull();
  });

  test('preserves non-cache keys', async () => {
    await AsyncStorage.setItem('other-key', 'preserved');
    await setCache('machinesList', [1]);

    await clearAllCaches();

    expect(await AsyncStorage.getItem('other-key')).toBe('preserved');
  });
});

describe('cacheFirst', () => {
  test('calls fetchFn on cache miss', async () => {
    const fetchFn = jest.fn().mockResolvedValue([{ id: '1' }]);
    const result = await cacheFirst('machinesList', fetchFn);

    expect(result).toEqual([{ id: '1' }]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('returns cached data on cache hit and triggers background refresh', async () => {
    await setCache('machinesList', [{ id: 'old' }]);
    const fetchFn = jest.fn().mockResolvedValue([{ id: 'new' }]);

    const result = await cacheFirst('machinesList', fetchFn);

    // Returns cached immediately
    expect(result).toEqual([{ id: 'old' }]);
    // Background refresh was triggered
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('stores fresh data after cache miss', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ x: 1 });
    await cacheFirst('machineDetail', fetchFn);

    const cached = await getCached('machineDetail');
    expect(cached).toEqual({ x: 1 });
  });
});
