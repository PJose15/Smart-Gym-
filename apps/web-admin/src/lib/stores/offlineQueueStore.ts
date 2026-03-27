/**
 * Offline Queue Store — IndexedDB-backed set queue.
 * Sets are written to IndexedDB first, then synced to the API.
 * On network failure, sets remain queued and sync on reconnect.
 */

const DB_NAME = 'nexera-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-sets';

interface QueuedSet {
  id: string;
  gym_id: string;
  machine_id: string;
  member_id: string;
  session_date: string;
  workout_mode: string;
  set: {
    weight_lbs: number;
    reps: number;
    rpe: number | null;
    notes?: string;
  };
  queued_at: string;
  synced: number; // 0 = pending, 1 = synced
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueSet(data: Omit<QueuedSet, 'id' | 'queued_at' | 'synced'>): Promise<string> {
  const db = await openDB();
  const id = `set_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry: QueuedSet = {
    ...data,
    id,
    queued_at: new Date().toISOString(),
    synced: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(entry);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function markSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const get = store.get(id);
    get.onsuccess = () => {
      if (get.result) {
        store.put({ ...get.result, synced: 1 });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSets(): Promise<QueuedSet[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('synced');
    const request = index.getAll(IDBKeyRange.only(0));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearSyncedSets(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('synced');
    const request = index.openCursor(IDBKeyRange.only(1));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
