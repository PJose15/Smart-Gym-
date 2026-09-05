import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

// expo-secure-store has a 2048-byte value limit on iOS.
// Supabase auth tokens can exceed this. We chunk large values.
const CHUNK_SIZE = 1800;

const memoryStore: Record<string, string> = {};
const webStorage = {
  getItem: (key: string) =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(key) : (memoryStore[key] ?? null),
  setItem: (key: string, value: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    else memoryStore[key] = value;
  },
  removeItem: (key: string) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    else delete memoryStore[key];
  },
};

const LargeSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return webStorage.getItem(key);
    }

    const value = await SecureStore.getItemAsync(key);
    if (value === null) return null;

    // Check if it's a chunked value
    if (value.startsWith('__chunked__:')) {
      const parts = value.split(':');
      const count = parseInt(parts[1] ?? '0', 10);
      if (!count || isNaN(count)) return null;
      const chunks: string[] = [];
      for (let i = 0; i < count; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
        if (chunk === null) return null;
        chunks.push(chunk);
      }
      return chunks.join('');
    }

    return value;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      webStorage.setItem(key, value);
      return;
    }

    // Clean up any existing chunks first
    await LargeSecureStoreAdapter.removeItem(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    // Chunk the value
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.substring(i, i + CHUNK_SIZE));
    }

    await SecureStore.setItemAsync(key, `__chunked__:${chunks.length}`);
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      webStorage.removeItem(key);
      return;
    }

    const existing = await SecureStore.getItemAsync(key);
    if (existing?.startsWith('__chunked__:')) {
      const parts = existing.split(':');
      const count = parseInt(parts[1] ?? '0', 10);
      if (count && !isNaN(count)) {
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
        }
      }
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: LargeSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// React Native has no browser visibility events, so supabase-js can't tell
// when the app is backgrounded — its refresh timer is suspended by the OS and
// tokens silently expire. Tie the auto-refresh loop to AppState instead
// (standard Supabase RN pattern): refresh while active, pause in background.
// A refresh is triggered immediately on foregrounding if the token is stale.
if (Platform.OS !== 'web') {
  supabase.auth.startAutoRefresh();
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
