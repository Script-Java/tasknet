import { useEffect, useRef } from 'react';
import { syncWithSupabase } from '../lib/sync';
import { supabase } from '../lib/supabase';

export function useAutoSync() {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const doSync = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        syncWithSupabase().catch(err => {
          console.error('Auto-sync failed:', err);
        });
      }, 1000);
    };

    const handleOnline = () => doSync();

    window.addEventListener('online', handleOnline);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        doSync();
      }
    });

    intervalRef.current = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) doSync();
      });
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
}
