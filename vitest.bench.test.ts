import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncWithSupabase } from './src/lib/sync';
import { supabase } from './src/lib/supabase';
import * as store from './src/lib/store';
import { v4 as uuidv4 } from 'uuid';

vi.mock('./src/lib/supabase', () => {
  let callCount = 0;
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        return {
          upsert: vi.fn().mockImplementation(async () => {
            callCount++;
            await new Promise(r => setTimeout(r, 5));
            return { error: null };
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(async () => {
              callCount++;
              await new Promise(r => setTimeout(r, 5));
              return { error: null };
            }),
            in: vi.fn().mockImplementation(async () => {
              callCount++;
              await new Promise(r => setTimeout(r, 5));
              return { error: null };
            })
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        };
      }),
      _getCallCount: () => callCount,
      _resetCallCount: () => { callCount = 0; }
    },
  };
});

vi.mock('./src/lib/store', () => ({
  getAll: vi.fn(),
  clearPendingChanges: vi.fn(),
  getLastSyncedAt: vi.fn(),
  setLastSyncedAt: vi.fn(),
  syncOverwriteRecord: vi.fn(),
}));

describe('sync benchmark', () => {
  beforeEach(() => {
    (supabase as any)._resetCallCount();
  });

  it('runs sync benchmark', async () => {
    const numChanges = 50;
    const changes = [];
    for (let i = 0; i < numChanges; i++) {
      changes.push({
        id: uuidv4(),
        table: 'tasks',
        action: 'INSERT',
        record_id: `rec_${i}`,
        data: { id: `rec_${i}`, title: `Task ${i}` },
        timestamp: new Date().toISOString()
      });
    }

    vi.mocked(store.getAll).mockImplementation(async (table: any) => {
      if (table === 'pendingChanges') return changes as any;
      return [];
    });

    const start = performance.now();
    await syncWithSupabase();
    const end = performance.now();

    console.log(`Time taken: ${(end - start).toFixed(2)}ms`);
    console.log(`Supabase calls: ${(supabase as any)._getCallCount()}`);
  });
});
