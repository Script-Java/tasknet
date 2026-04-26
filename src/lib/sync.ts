import { supabase } from './supabase';
import {
  getAll,
  clearPendingChanges,
  getLastSyncedAt,
  setLastSyncedAt,
  initDB
} from './store';
import type { PendingChange, TableName } from './types';

let syncLock = false;

export async function syncWithSupabase() {
  if (syncLock) return;
  syncLock = true;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      console.log('User not logged in, skipping sync');
      return;
    }

    // 1. Push local changes
    const pendingChanges = await getAll('pendingChanges') as PendingChange[];
    if (pendingChanges.length > 0) {
      const success = await pushChanges(pendingChanges);
      if (!success) {
        throw new Error('Failed to push some changes');
      }
    }

    // 2. Pull remote changes
    const lastSyncedAt = await getLastSyncedAt();
    await pullChanges(lastSyncedAt, sessionData.session.user.id);

    // 3. Only clear pending + update sync time after everything succeeds
    if (pendingChanges.length > 0) {
      await clearPendingChanges();
    }
    await setLastSyncedAt(new Date().toISOString());
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  } finally {
    syncLock = false;
  }
}

async function pushChanges(changes: PendingChange[]) {
  const tableGroups = new Map<TableName, { upserts: PendingChange[]; deletes: PendingChange[] }>();

  for (const change of changes) {
    const { table, action } = change;
    if (!tableGroups.has(table)) {
      tableGroups.set(table, { upserts: [], deletes: [] });
    }
    const group = tableGroups.get(table)!;
    if (action === 'INSERT' || action === 'UPDATE') {
      group.upserts.push(change);
    } else if (action === 'DELETE') {
      group.deletes.push(change);
    }
  }

  let allSuccess = true;

  for (const [table, { upserts, deletes }] of tableGroups) {
    // Batch upsert: send all rows for this table in one call
    if (upserts.length > 0) {
      const rows = upserts.map(c => c.data).filter(Boolean);
      const { error } = await supabase
        .from(table)
        .upsert(rows);

      if (error) {
        console.error(`Error batch upserting to ${table}:`, error);
        allSuccess = false;
      }
    }

    // Batch delete: use .in('id', [ids]) for all deletes in this table
    if (deletes.length > 0) {
      const ids = deletes.map(c => c.record_id);
      const { error } = await supabase
        .from(table)
        .delete()
        .in('id', ids);

      if (error) {
        console.error(`Error batch deleting from ${table}:`, error);
        allSuccess = false;
      }
    }
  }

  return allSuccess;
}

async function pullChanges(_lastSyncedAt: string | null, userId: string) {
  const tables: Array<'tasks' | 'habits' | 'calendar_entries'> = ['tasks', 'habits', 'calendar_entries'];
  const db = await initDB();

  for (const table of tables) {
    const query = supabase.from(table).select('*').eq('user_id', userId);

    const { data, error } = await query;

    if (error) {
      console.error(`Error pulling ${table}:`, error);
      continue;
    }

    if (data && data.length > 0) {
      const tx = db.transaction(table, 'readwrite');
      const store = tx.objectStore(table);
      for (const record of data) {
        store.put(record);
      }
      await tx.done;
    }
  }
}