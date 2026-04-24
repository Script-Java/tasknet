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
    await pullChanges(lastSyncedAt);

    // Update sync time
    await setLastSyncedAt(new Date().toISOString());
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}

async function pushChanges(changes: PendingChange[]) {
  const promises = changes.map(async (change) => {
    const { table, action, record_id, data } = change;
    let success = true;

    try {
      if (action === 'INSERT' || action === 'UPDATE') {
        const { error } = await supabase
          .from(table)
          .upsert(data);

        if (error) {
          console.error(`Error pushing ${action} to ${table}:`, error);
          success = false;
        }
      } else if (action === 'DELETE') {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', record_id);

        if (error) {
          console.error(`Error pushing DELETE to ${table}:`, error);
          success = false;
        }
      }
    } catch (e) {
      console.error(`Unexpected error pushing ${action} to ${table}:`, e);
      success = false;
    }

    return success;
  });

  const results = await Promise.all(promises);
  return results.every((res) => res === true);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function pullChanges(_lastSyncedAt: string | null) {
  const tables: Array<'tasks' | 'habits' | 'calendar_entries'> = ['tasks', 'habits', 'calendar_entries'];

  for (const table of tables) {
    const query = supabase.from(table).select('*');

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
