import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Task, Habit, CalendarEntry, PendingChange } from './types';


interface FidesDB extends DBSchema {
  tasks: {
    key: string;
    value: Task;
  };
  habits: {
    key: string;
    value: Habit;
  };
  calendar_entries: {
    key: string;
    value: CalendarEntry;
  };
  pendingChanges: {
    key: string;
    value: PendingChange;
  };
  syncMeta: {
    key: string;
    value: { lastSyncedAt: string | null };
  };
}

const DB_NAME = 'FidesDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<FidesDB>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<FidesDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('habits')) db.createObjectStore('habits', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('calendar_entries')) db.createObjectStore('calendar_entries', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('pendingChanges')) db.createObjectStore('pendingChanges', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('syncMeta')) db.createObjectStore('syncMeta');
      },
    });
  }
  return dbPromise;
};

// Generic read
export async function getAll<T extends 'tasks' | 'habits' | 'calendar_entries' | 'pendingChanges'>(
  storeName: T
) {
  const db = await initDB();
  return db.getAll(storeName);
}

export async function getById<T extends 'tasks' | 'habits' | 'calendar_entries' | 'pendingChanges'>(
  storeName: T,
  id: string
) {
  const db = await initDB();
  return db.get(storeName, id);
}

// Add pending change helper
// // async function addPendingChange(table: 'tasks' | 'habits' | 'calendar_entries', action: 'INSERT' | 'UPDATE' | 'DELETE', record_id: string, data?: any) {
//   const db = await initDB();
//   const change: PendingChange = {
//     id: uuidv4(),
//     table,
//     action,
//     record_id,
//     data,
//     timestamp: new Date().toISOString()
//   };
//   await db.put('pendingChanges', change);
// }

// Write/Update with pending change
export async function upsertRecord(table: 'tasks' | 'habits' | 'calendar_entries', record: Task | Habit | CalendarEntry) {
  const db = await initDB();
  const tx = db.transaction([table, 'pendingChanges'], 'readwrite');

  const existing = await tx.objectStore(table).get(record.id);
  const action = existing ? 'UPDATE' : 'INSERT';

  await tx.objectStore(table).put(record);

  const change: PendingChange = {
    id: crypto.randomUUID(),
    table,
    action,
    record_id: record.id,
    data: record,
    timestamp: new Date().toISOString()
  };
  await tx.objectStore('pendingChanges').put(change);

  await tx.done;
}

export async function deleteRecord(table: 'tasks' | 'habits' | 'calendar_entries', id: string) {
  const db = await initDB();
  const tx = db.transaction([table, 'pendingChanges'], 'readwrite');

  await tx.objectStore(table).delete(id);

  const change: PendingChange = {
    id: crypto.randomUUID(),
    table,
    action: 'DELETE',
    record_id: id,
    timestamp: new Date().toISOString()
  };
  await tx.objectStore('pendingChanges').put(change);

  await tx.done;
}

// Sync metadata
export async function getLastSyncedAt(): Promise<string | null> {
  const db = await initDB();
  const meta = await db.get('syncMeta', 'meta');
  return meta ? meta.lastSyncedAt : null;
}

export async function setLastSyncedAt(timestamp: string) {
  const db = await initDB();
  await db.put('syncMeta', { lastSyncedAt: timestamp }, 'meta');
}

export async function clearPendingChanges() {
    const db = await initDB();
    await db.clear('pendingChanges');
}

// Sync overwrite directly from remote without adding to pendingChanges
export async function syncOverwriteRecord(table: 'tasks' | 'habits' | 'calendar_entries', record: Task | Habit | CalendarEntry) {
    const db = await initDB();
    await db.put(table, record);
}

export async function syncDeleteRecord(table: 'tasks' | 'habits' | 'calendar_entries', id: string) {
    const db = await initDB();
    await db.delete(table, id);
}
