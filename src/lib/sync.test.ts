import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncWithSupabase } from './sync';
import * as store from './store';
import { supabase } from './supabase';
import type { PendingChange } from './types';

vi.mock('./store', () => ({
  getAll: vi.fn(),
  clearPendingChanges: vi.fn(),
  getLastSyncedAt: vi.fn(),
  setLastSyncedAt: vi.fn(),
  syncOverwriteRecord: vi.fn(),
}));

vi.mock('./supabase', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
      },
      from: vi.fn(),
    },
  };
});

describe('syncWithSupabase', () => {
  let mockUpsert: any;
  let mockEq: any;
  let mockDelete: any;
  let mockSelect: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mockEq = vi.fn().mockResolvedValue({ error: null });
    mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
    mockSelect = vi.fn().mockResolvedValue({ data: [], error: null });

    (supabase.from as any).mockReturnValue({
      upsert: mockUpsert,
      delete: mockDelete,
      select: mockSelect,
    });
  });

  it('should skip sync and return early if there is no logged-in user', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });

    await syncWithSupabase();

    expect(store.getAll).not.toHaveBeenCalled();
    expect(store.getLastSyncedAt).not.toHaveBeenCalled();
  });

  it('should push pending changes, pull remote changes, and set last synced at', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });

    const pendingChanges: PendingChange[] = [
      { id: '1', table: 'tasks', action: 'INSERT', record_id: 't1', data: { id: 't1', title: 'Task 1' }, timestamp: '2023-01-01' },
      { id: '2', table: 'habits', action: 'UPDATE', record_id: 'h1', data: { id: 'h1', title: 'Habit 1' }, timestamp: '2023-01-01' },
      { id: '3', table: 'calendar_entries', action: 'DELETE', record_id: 'c1', timestamp: '2023-01-01' },
    ];
    (store.getAll as any).mockResolvedValue(pendingChanges);
    (store.getLastSyncedAt as any).mockResolvedValue('2023-01-01T00:00:00.000Z');

    const fakeTasksData = [{ id: 't1', title: 'Remote Task' }];
    mockSelect.mockResolvedValueOnce({ data: fakeTasksData, error: null }); // For tasks
    mockSelect.mockResolvedValueOnce({ data: [], error: null }); // For habits
    mockSelect.mockResolvedValueOnce({ data: [], error: null }); // For calendar_entries

    await syncWithSupabase();

    // Verify pushes
    expect(supabase.from).toHaveBeenCalledWith('tasks');
    expect(supabase.from).toHaveBeenCalledWith('habits');
    expect(supabase.from).toHaveBeenCalledWith('calendar_entries');

    expect(mockUpsert).toHaveBeenCalledWith({ id: 't1', title: 'Task 1' });
    expect(mockUpsert).toHaveBeenCalledWith({ id: 'h1', title: 'Habit 1' });
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('id', 'c1');

    expect(store.clearPendingChanges).toHaveBeenCalled();

    // Verify pulls
    expect(store.getLastSyncedAt).toHaveBeenCalled();
    expect(store.syncOverwriteRecord).toHaveBeenCalledWith('tasks', fakeTasksData[0]);

    expect(store.setLastSyncedAt).toHaveBeenCalled();
  });

  it('should handle push failures appropriately without clearing pending changes', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });

    const pendingChanges: PendingChange[] = [
      { id: '1', table: 'tasks', action: 'INSERT', record_id: 't1', data: { id: 't1' }, timestamp: '2023-01-01' },
    ];
    (store.getAll as any).mockResolvedValue(pendingChanges);

    mockUpsert.mockResolvedValue({ error: new Error('Upsert Failed') });

    await expect(syncWithSupabase()).rejects.toThrow('Failed to push some changes, aborting clear');

    expect(store.clearPendingChanges).not.toHaveBeenCalled();
    expect(store.getLastSyncedAt).not.toHaveBeenCalled();
  });

  it('should handle pull errors correctly and continue to next table', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    (store.getAll as any).mockResolvedValue([]); // No pending changes
    (store.getLastSyncedAt as any).mockResolvedValue('2023-01-01T00:00:00.000Z');

    mockSelect.mockResolvedValueOnce({ data: null, error: new Error('Select Failed') }); // For tasks
    const fakeHabitsData = [{ id: 'h1', title: 'Remote Habit' }];
    mockSelect.mockResolvedValueOnce({ data: fakeHabitsData, error: null }); // For habits
    mockSelect.mockResolvedValueOnce({ data: [], error: null }); // For calendar_entries

    await syncWithSupabase();

    expect(store.syncOverwriteRecord).toHaveBeenCalledWith('habits', fakeHabitsData[0]);
    // It should still set last synced at despite pull failures
    expect(store.setLastSyncedAt).toHaveBeenCalled();
  });

  it('should propagate generic errors from push changes or other async parts', async () => {
    (supabase.auth.getSession as any).mockRejectedValue(new Error('Session Error'));

    await expect(syncWithSupabase()).rejects.toThrow('Session Error');
  });
});
