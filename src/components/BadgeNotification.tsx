import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { BADGE_BY_ID } from '../lib/badges';

export interface BadgeNotificationItem {
  id: string;
  badgeId: string;
}

export function BadgeNotification({
  items,
  onDismiss,
}: {
  items: BadgeNotificationItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-3 pointer-events-none">
      <AnimatePresence>
        {items.map((item) => (
          <NotificationCard key={item.id} item={item} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function NotificationCard({
  item,
  onDismiss,
}: {
  item: BadgeNotificationItem;
  onDismiss: (id: string) => void;
}) {
  const badge = BADGE_BY_ID[item.badgeId];
  if (!badge) return null;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), 6000);
    return () => clearTimeout(t);
  }, [item.id, onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="pointer-events-auto relative flex items-center gap-4 px-5 py-4 rounded-2xl border shadow-2xl backdrop-blur-xl"
      style={{
        background: 'linear-gradient(135deg, rgba(21,18,42,0.96) 0%, rgba(13,11,30,0.99) 100%)',
        borderColor: 'rgba(139, 92, 246, 0.35)',
        boxShadow: '0 0 40px rgba(139, 92, 246, 0.15), 0 8px 32px rgba(0,0,0,0.4)',
        maxWidth: '440px',
        width: 'calc(100vw - 2rem)',
      }}
    >
      <div className="relative flex-shrink-0">
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{ background: 'rgba(139, 92, 246, 0.25)', filter: 'blur(14px)' }}
        />
        <img
          src={badge.image}
          alt={badge.name}
          className="relative w-16 h-16 object-contain"
          style={{ filter: 'drop-shadow(0 0 10px rgba(139,92,246,0.5))' }}
        />
      </div>

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Sparkles className="w-3.5 h-3.5 text-[#FFB74D]" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-[#A78BFA]">
            Achievement Unlocked
          </span>
        </div>
        <h4 className="text-[#EEEEF8] font-bold text-[15px] truncate">{badge.name}</h4>
        <p className="text-[#8E89B3] text-xs leading-relaxed" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {badge.description}
        </p>
      </div>

      <button
        onClick={() => onDismiss(item.id)}
        className="flex-shrink-0 p-1.5 text-[#5C5780] hover:text-[#EEEEF8] transition-colors rounded-lg hover:bg-[rgba(255,255,255,0.05)]"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
