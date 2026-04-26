import { createContext, useContext, useState, useCallback } from 'react';
import { BadgeNotification } from '../components/BadgeNotification';
import type { BadgeNotificationItem } from '../components/BadgeNotification';

interface BadgeContextValue {
  notifications: BadgeNotificationItem[];
  showBadge: (badgeId: string) => void;
  dismissBadge: (id: string) => void;
}

const BadgeContext = createContext<BadgeContextValue | null>(null);

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<BadgeNotificationItem[]>([]);

  const showBadge = useCallback((badgeId: string) => {
    const id = `${badgeId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setNotifications((prev) => [...prev, { id, badgeId }]);
  }, []);

  const dismissBadge = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <BadgeContext.Provider value={{ notifications, showBadge, dismissBadge }}>
      {children}
      <BadgeNotification items={notifications} onDismiss={dismissBadge} />
    </BadgeContext.Provider>
  );
}

export function useBadgeContext() {
  const ctx = useContext(BadgeContext);
  if (!ctx) throw new Error('useBadgeContext must be used within BadgeProvider');
  return ctx;
}
