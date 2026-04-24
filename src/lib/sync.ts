import { supabase } from './supabase';
import {
  getAll,
  clearPendingChanges,
  getLastSyncedAt,
  setLastSyncedAt,
  syncOverwriteRecord
} from './store';
import type { PendingChange } from './types';

export async function syncWithSupabase() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    console.log('User not logged in, skipping sync');
    return;
  }

  try {
    // 1. Push local changes
    const pendingChanges = await getAll('pendingChanges');
    if (pendingChanges.length > 0) {
      const success = await pushChanges(pendingChanges);
      if (success) {
        await clearPendingChanges();
      } else {
        throw new Error('Failed to push some changes, aborting clear');
      }
    }

    // 2. Pull remote changes
    const lastSyncedAt = await getLastSyncedAt();
    await pullChanges(lastSyncedAt, sessionData.session.user.id);

    // Update sync time
    await setLastSyncedAt(new Date().toISOString());
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}

async function pushChanges(changes: PendingChange[]) {
  let allSuccess = true;

  // Group changes by table
  const groupedChanges: Record<string, PendingChange[]> = {};
  for (const change of changes) {
    if (!groupedChanges[change.table]) {
      groupedChanges[change.table] = [];
    }
    groupedChanges[change.table].push(change);
  }

  for (const [table, tableChanges] of Object.entries(groupedChanges)) {
    // Resolve the final state for each record_id in this table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolvedRecords: Record<string, { action: 'UPSERT' | 'DELETE', data?: any }> = {};

    for (const change of tableChanges) {
      if (change.action === 'INSERT' || change.action === 'UPDATE') {
        resolvedRecords[change.record_id] = { action: 'UPSERT', data: change.data };
      } else if (change.action === 'DELETE') {
        resolvedRecords[change.record_id] = { action: 'DELETE' };
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upserts: any[] = [];
    const deletes: string[] = [];

    for (const [record_id, resolution] of Object.entries(resolvedRecords)) {
      if (resolution.action === 'UPSERT') {
        upserts.push(resolution.data);
      } else if (resolution.action === 'DELETE') {
        deletes.push(record_id);
      }
    }

    // Execute bulk upserts
    if (upserts.length > 0) {
      const { error } = await supabase
        .from(table)
        .upsert(upserts);

      if (error) {
        console.error(`Error bulk pushing UPSERT to ${table}:`, error);
        allSuccess = false;
      }
    }

    // Execute bulk deletes
    if (deletes.length > 0) {
      const { error } = await supabase
        .from(table)
        .delete()
        .in('id', deletes);

      if (error) {
        console.error(`Error bulk pushing DELETE to ${table}:`, error);
        allSuccess = false;
      }
    }
  }

  return allSuccess;
}

async function pullChanges(_lastSyncedAt: string | null, userId: string) {
  const tables: Array<'tasks' | 'habits' | 'calendar_entries'> = ['tasks', 'habits', 'calendar_entries'];

  for (const table of tables) {
    const query = supabase.from(table).select('*').eq('user_id', userId);

    // In a real app we would have a 'updated_at' or soft delete to only pull diffs.
    // Here we pull all data for the user to ensure sync. Supabase RLS handles user scoping.
    const { data, error } = await query;

    if (error) {
      console.error(`Error pulling ${table}:`, error);
      continue;
    }

    if (data) {
      // Overwrite local records with remote records
      for (const record of data) {
        await syncOverwriteRecord(table, record);
      }
    }
  }
}
