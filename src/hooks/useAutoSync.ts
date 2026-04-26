import { useEffect, useRef } from 'react';
import { syncWithSupabase } from '../lib/sync';

export function useAutoSync() {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        syncWithSupabase().catch(err => {
          console.error('Auto-sync on reconnect failed:', err);
        });
      }, 1000);
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);
}