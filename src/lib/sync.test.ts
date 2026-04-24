import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncWithSupabase } from './sync';
import { supabase } from './supabase';
import * as store from './store';

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
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
    expect(console.log).toHaveBeenCalledWith('User not logged in, skipping sync');
  });

  it('handles and re-throws errors during sync', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'test-user' } } }
    } as any);

    const testError = new Error('Database error');
    vi.mocked(store.getAll).mockRejectedValue(testError);

    await expect(syncWithSupabase()).rejects.toThrow('Database error');
    expect(console.error).toHaveBeenCalledWith('Sync failed:', testError);
  });

  it('throws an error if push changes fail', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'test-user' } } }
    } as any);

    // Mock pending changes
    vi.mocked(store.getAll).mockResolvedValue([
      { table: 'tasks', action: 'INSERT', record_id: '1', data: { id: '1' } }
    ] as any);

    // Mock supabase.from to return an error
    const upsertMock = vi.fn().mockResolvedValue({ error: new Error('Upsert failed') });
    vi.mocked(supabase.from).mockReturnValue({
      upsert: upsertMock,
      delete: vi.fn().mockReturnValue({ eq: vi.fn() }),
      select: vi.fn()
    } as any);

    await expect(syncWithSupabase()).rejects.toThrow('Failed to push some changes, aborting clear');
    expect(console.error).toHaveBeenCalledWith('Sync failed:', expect.any(Error));
  });

  it('successfully pushes and pulls changes', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'test-user' } } }
    } as any);

    vi.mocked(store.getAll).mockResolvedValue([
      { table: 'tasks', action: 'INSERT', record_id: '1', data: { id: '1' } },
      { table: 'habits', action: 'DELETE', record_id: '2', data: null }
    ] as any);

    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
    const upsertMock = vi.fn().mockResolvedValue({ error: null });

    // For pullChanges
    const eqSelectMock = vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null });
    const selectMock = vi.fn().mockReturnValue({ eq: eqSelectMock });

    vi.mocked(supabase.from).mockReturnValue({
      upsert: upsertMock,
      delete: deleteMock,
      select: selectMock
    } as any);

    vi.mocked(store.getLastSyncedAt).mockResolvedValue('2023-01-01T00:00:00.000Z');

    await syncWithSupabase();

    expect(store.clearPendingChanges).toHaveBeenCalled();
    expect(store.syncOverwriteRecord).toHaveBeenCalled();
    expect(store.setLastSyncedAt).toHaveBeenCalled();
  });
});
