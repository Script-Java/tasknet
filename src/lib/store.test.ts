import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  initDB,
  upsertRecord,
  getAll,
  getById,
  deleteRecord,
  setLastSyncedAt,
  getLastSyncedAt,
  clearPendingChanges,
  syncOverwriteRecord,
  syncDeleteRecord
} from './store';

describe('store utilities', () => {
  beforeEach(async () => {
    // Clear the database for each test to ensure isolation
    const db = await initDB();
    const tx = db.transaction(['tasks', 'habits', 'calendar_entries', 'pendingChanges', 'syncMeta'], 'readwrite');
    await Promise.all([
      tx.objectStore('tasks').clear(),
      tx.objectStore('habits').clear(),
      tx.objectStore('calendar_entries').clear(),
      tx.objectStore('pendingChanges').clear(),
      tx.objectStore('syncMeta').clear(),
      tx.done
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initDB initializes the database with the correct stores', async () => {
    const db = await initDB();
    expect(db.objectStoreNames.contains('tasks')).toBe(true);
    expect(db.objectStoreNames.contains('habits')).toBe(true);
    expect(db.objectStoreNames.contains('calendar_entries')).toBe(true);
    expect(db.objectStoreNames.contains('pendingChanges')).toBe(true);
    expect(db.objectStoreNames.contains('syncMeta')).toBe(true);
  });

  it('upsertRecord inserts a new record and records the pending change', async () => {
    const testRecord = { id: 'task-1', title: 'Test Task' };
    await upsertRecord('tasks', testRecord);

    const dbRecord = await getById('tasks', 'task-1');
    expect(dbRecord).toEqual(testRecord);

    const pendingChanges = await getAll('pendingChanges');
    expect(pendingChanges.length).toBe(1);
    expect(pendingChanges[0].table).toBe('tasks');
    expect(pendingChanges[0].action).toBe('INSERT');
    expect(pendingChanges[0].record_id).toBe('task-1');
    expect(pendingChanges[0].data).toEqual(testRecord);
  });

  it('upsertRecord updates an existing record and records the pending change', async () => {
    const initialRecord = { id: 'task-2', title: 'Initial Task' };
    await upsertRecord('tasks', initialRecord);

    const updatedRecord = { id: 'task-2', title: 'Updated Task' };
    await upsertRecord('tasks', updatedRecord);

    const dbRecord = await getById('tasks', 'task-2');
    expect(dbRecord).toEqual(updatedRecord);

    const pendingChanges = await getAll('pendingChanges');
    // We expect two pending changes now: one INSERT, one UPDATE
    expect(pendingChanges.length).toBe(2);

    const updateChange = pendingChanges.find(c => c.action === 'UPDATE');
    expect(updateChange).toBeDefined();
    expect(updateChange!.table).toBe('tasks');
    expect(updateChange!.record_id).toBe('task-2');
    expect(updateChange!.data).toEqual(updatedRecord);
  });

  it('deleteRecord deletes a record and records the pending change', async () => {
    const testRecord = { id: 'task-3', title: 'Task to Delete' };
    await upsertRecord('tasks', testRecord);

    await deleteRecord('tasks', 'task-3');

    const dbRecord = await getById('tasks', 'task-3');
    expect(dbRecord).toBeUndefined();

    const pendingChanges = await getAll('pendingChanges');
    const deleteChange = pendingChanges.find(c => c.action === 'DELETE');
    expect(deleteChange).toBeDefined();
    expect(deleteChange!.table).toBe('tasks');
    expect(deleteChange!.record_id).toBe('task-3');
  });

  it('syncMeta functions set and get last synced timestamp', async () => {
    const timestamp = '2023-01-01T00:00:00.000Z';

    await setLastSyncedAt(timestamp);
    const retrievedTimestamp = await getLastSyncedAt();

    expect(retrievedTimestamp).toBe(timestamp);
  });

  it('clearPendingChanges clears all pending changes', async () => {
    const testRecord = { id: 'task-4', title: 'Test Task' };
    await upsertRecord('tasks', testRecord);

    let pendingChanges = await getAll('pendingChanges');
    expect(pendingChanges.length).toBeGreaterThan(0);

    await clearPendingChanges();

    pendingChanges = await getAll('pendingChanges');
    expect(pendingChanges.length).toBe(0);
  });

  it('syncOverwriteRecord overwrites a record without creating a pending change', async () => {
    const testRecord = { id: 'task-5', title: 'Remote Task' };
    await syncOverwriteRecord('tasks', testRecord);

    const dbRecord = await getById('tasks', 'task-5');
    expect(dbRecord).toEqual(testRecord);

    const pendingChanges = await getAll('pendingChanges');
    expect(pendingChanges.length).toBe(0);
  });

  it('syncDeleteRecord deletes a record without creating a pending change', async () => {
    const testRecord = { id: 'task-6', title: 'Remote Task to Delete' };
    await syncOverwriteRecord('tasks', testRecord); // Setup using sync so no pending change is made

    await syncDeleteRecord('tasks', 'task-6');

    const dbRecord = await getById('tasks', 'task-6');
    expect(dbRecord).toBeUndefined();

    const pendingChanges = await getAll('pendingChanges');
    expect(pendingChanges.length).toBe(0);
  });
});
