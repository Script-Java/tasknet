import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncWithSupabase } from './sync';
import { supabase } from './supabase';
import * as store from './store';
import type { PendingChange } from './types';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock('./store', () => ({
  getAll: vi.fn(),
  clearPendingChanges: vi.fn(),
  getLastSyncedAt: vi.fn(),
  setLastSyncedAt: vi.fn(),
  syncOverwriteRecord: vi.fn(),
}));

describe('syncWithSupabase', () => {
  let mockUpsert: any;
  let mockDeleteEq: any;
  let mockDelete: any;
  let mockSelectEq: any;
  let mockSelect: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
    mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });
    mockSelectEq = vi.fn().mockResolvedValue({ data: [], error: null });
    mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq });

    vi.mocked(supabase.from).mockReturnValue({
      upsert: mockUpsert,
      delete: mockDelete,
      select: mockSelect,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips sync if user is not logged in', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null }
    } as any);

    await syncWithSupabase();

    expect(store.getAll).not.toHaveBeenCalled();
    expect(store.getLastSyncedAt).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('User not logged in, skipping sync');
  });

  it('should push pending changes, pull remote changes, and set last synced at', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'u1' } } }
    } as any);

    const pendingChanges: PendingChange[] = [
      { id: '1', table: 'tasks', action: 'INSERT', record_id: 't1', data: { id: 't1', title: 'Task 1' }, timestamp: '2023-01-01' },
      { id: '2', table: 'habits', action: 'UPDATE', record_id: 'h1', data: { id: 'h1', title: 'Habit 1' }, timestamp: '2023-01-01' },
      { id: '3', table: 'calendar_entries', action: 'DELETE', record_id: 'c1', timestamp: '2023-01-01' },
    ];
    vi.mocked(store.getAll).mockResolvedValue(pendingChanges as any);
    vi.mocked(store.getLastSyncedAt).mockResolvedValue('2023-01-01T00:00:00.000Z');

    const fakeTasksData = [{ id: 't1', title: 'Remote Task' }];
    mockSelectEq.mockResolvedValueOnce({ data: fakeTasksData, error: null }); // For tasks
    mockSelectEq.mockResolvedValueOnce({ data: [], error: null }); // For habits
    mockSelectEq.mockResolvedValueOnce({ data: [], error: null }); // For calendar_entries

    await syncWithSupabase();

    // Verify pushes
    expect(supabase.from).toHaveBeenCalledWith('tasks');
    expect(supabase.from).toHaveBeenCalledWith('habits');
    expect(supabase.from).toHaveBeenCalledWith('calendar_entries');

    expect(mockUpsert).toHaveBeenCalledWith({ id: 't1', title: 'Task 1' });
    expect(mockUpsert).toHaveBeenCalledWith({ id: 'h1', title: 'Habit 1' });
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'c1');

    expect(store.clearPendingChanges).toHaveBeenCalled();

    // Verify pulls with user scoping
    expect(store.getLastSyncedAt).toHaveBeenCalled();
    expect(mockSelectEq).toHaveBeenCalledWith('user_id', 'u1');
    expect(store.syncOverwriteRecord).toHaveBeenCalledWith('tasks', fakeTasksData[0]);

    expect(store.setLastSyncedAt).toHaveBeenCalled();
  });

  it('should handle push failures appropriately without clearing pending changes', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'u1' } } }
    } as any);

    const pendingChanges: PendingChange[] = [
      { id: '1', table: 'tasks', action: 'INSERT', record_id: 't1', data: { id: 't1' }, timestamp: '2023-01-01' },
    ];
    vi.mocked(store.getAll).mockResolvedValue(pendingChanges as any);

    mockUpsert.mockResolvedValue({ error: new Error('Upsert Failed') });

    await expect(syncWithSupabase()).rejects.toThrow('Failed to push some changes, aborting clear');

    expect(store.clearPendingChanges).not.toHaveBeenCalled();
    expect(store.getLastSyncedAt).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('Sync failed:', expect.any(Error));
  });

  it('should handle pull errors correctly and continue to next table', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'u1' } } }
    } as any);
    vi.mocked(store.getAll).mockResolvedValue([]); // No pending changes
    vi.mocked(store.getLastSyncedAt).mockResolvedValue('2023-01-01T00:00:00.000Z');

    mockSelectEq.mockResolvedValueOnce({ data: null, error: new Error('Select Failed') }); // For tasks
    const fakeHabitsData = [{ id: 'h1', title: 'Remote Habit' }];
    mockSelectEq.mockResolvedValueOnce({ data: fakeHabitsData, error: null }); // For habits
    mockSelectEq.mockResolvedValueOnce({ data: [], error: null }); // For calendar_entries

    await syncWithSupabase();

    expect(store.syncOverwriteRecord).toHaveBeenCalledWith('habits', fakeHabitsData[0]);
    // It should still set last synced at despite pull failures
    expect(store.setLastSyncedAt).toHaveBeenCalled();
  });

  it('should propagate generic errors from push changes or other async parts', async () => {
    vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error('Session Error'));

    await expect(syncWithSupabase()).rejects.toThrow('Session Error');
  });
});
