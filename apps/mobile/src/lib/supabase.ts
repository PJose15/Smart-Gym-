import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// expo-secure-store has a 2048-byte value limit on iOS.
// Supabase auth tokens can exceed this. We chunk large values.
const CHUNK_SIZE = 1800;

const LargeSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const value = await SecureStore.getItemAsync(key);
    if (value === null) return null;

    // Check if it's a chunked value
    if (value.startsWith('__chunked__:')) {
      const count = parseInt(value.split(':')[1], 10);
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
    // Clean up any existing chunks first
    await LargeSecureStoreAdapter.removeItem(key);

    if (Platform.OS === 'web' || value.length <= CHUNK_SIZE) {
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
    const existing = await SecureStore.getItemAsync(key);
    if (existing?.startsWith('__chunked__:')) {
      const count = parseInt(existing.split(':')[1], 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
      }
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: LargeSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
