import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X, Trophy } from 'lucide-react';
import { BADGES, CATEGORY_ORDER, CATEGORY_LABELS, type BadgeCategory } from '../lib/badges';

interface BadgeGalleryProps {
  unlockedIds: string[];
}

export function BadgeGallery({ unlockedIds }: BadgeGalleryProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const unlockedSet = new Set(unlockedIds);

  return (
    <div className="space-y-10">
      {CATEGORY_ORDER.map((category) => {
        const categoryBadges = BADGES.filter((b) => b.category === category);
        const unlockedCount = categoryBadges.filter((b) => unlockedSet.has(b.id)).length;

        return (
          <section key={category}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#A78BFA] flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                {CATEGORY_LABELS[category as BadgeCategory]}
              </h3>
              <span className="text-xs font-semibold text-[#5C5780] bg-[rgba(21,18,42,0.6)] px-2.5 py-1 rounded-full border border-[#2A2545]">
                {unlockedCount} / {categoryBadges.length}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
              {categoryBadges.map((badge, index) => {
                const isUnlocked = unlockedSet.has(badge.id);
                return (
                  <motion.button
                    key={badge.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                    onClick={() => setSelected(badge.id)}
                    className={`relative group rounded-2xl p-3 transition-all duration-300 border ${
                      isUnlocked
                        ? 'border-[rgba(139,92,246,0.25)] bg-[rgba(21,18,42,0.6)] hover:bg-[rgba(30,26,58,0.8)]'
                        : 'border-[#2A2545] bg-[rgba(13,11,30,0.4)] opacity-55 hover:opacity-80'
                    }`}
                  >
                    {isUnlocked && (
                      <div
                        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                        style={{
                          boxShadow: 'inset 0 0 20px rgba(139,92,246,0.08), 0 0 24px rgba(139,92,246,0.08)',
                        }}
                      />
                    )}

                    <div className="aspect-square relative flex items-center justify-center mb-2">
                      <img
                        src={badge.image}
                        alt={badge.name}
                        draggable={false}
                        className={`w-full h-full object-contain transition-all duration-300 ${
                          isUnlocked ? '' : 'grayscale brightness-[0.35]'
                        }`}
                      />
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Lock className="w-5 h-5 text-[#5C5780]" />
                        </div>
                      )}
                    </div>

                    <p
                      className={`text-[11px] font-semibold text-center leading-tight ${
                        isUnlocked ? 'text-[#EEEEF8]' : 'text-[#5C5780]'
                      }`}
                    >
                      {badge.name}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </section>
        );
      })}

      <AnimatePresence>
        {selected && (
          <BadgeDetailModal
            badgeId={selected}
            isUnlocked={unlockedSet.has(selected)}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BadgeDetailModal({
  badgeId,
  isUnlocked,
  onClose,
}: {
  badgeId: string;
  isUnlocked: boolean;
  onClose: () => void;
}) {
  const badge = BADGES.find((b) => b.id === badgeId);
  if (!badge) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(6, 4, 15, 0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.88, y: 24, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl border p-8 text-center overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #1C1836 0%, #0F0D22 100%)',
          borderColor: isUnlocked ? 'rgba(139, 92, 246, 0.3)' : '#2A2545',
          boxShadow: isUnlocked
            ? '0 0 60px rgba(139, 92, 246, 0.12), 0 20px 40px rgba(0,0,0,0.5)'
            : '0 20px 40px rgba(0,0,0,0.5)',
        }}
      >
        {isUnlocked && (
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{
              background: 'linear-gradient(90deg, transparent, #8B5CF6, #A78BFA, transparent)',
            }}
          />
        )}

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#5C5780] hover:text-[#EEEEF8] transition-colors rounded-lg hover:bg-[rgba(255,255,255,0.04)]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative mx-auto w-28 h-28 mb-5">
          {isUnlocked && (
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ background: 'rgba(139, 92, 246, 0.2)', filter: 'blur(18px)' }}
            />
          )}
          <img
            src={badge.image}
            alt={badge.name}
            draggable={false}
            className={`relative w-full h-full object-contain ${isUnlocked ? '' : 'grayscale brightness-50'}`}
          />
          {!isUnlocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Lock className="w-8 h-8 text-[#5C5780] drop-shadow-md" />
            </div>
          )}
        </div>

        <h3
          className={`text-2xl font-black mb-2 tracking-tight ${
            isUnlocked ? 'text-[#EEEEF8]' : 'text-[#8E89B3]'
          }`}
        >
          {badge.name}
        </h3>
        <p className="text-[#8E89B3] text-sm leading-relaxed mb-6">{badge.description}</p>

        {!isUnlocked && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(139,92,246,0.08)] border border-[rgba(139,92,246,0.18)] text-xs font-bold text-[#A78BFA]">
            <Lock className="w-3.5 h-3.5" />
            Locked — complete the requirement to unlock
          </div>
        )}

        {isUnlocked && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(102,187,106,0.1)] border border-[rgba(102,187,106,0.25)] text-xs font-bold text-[#66BB6A]">
            Unlocked
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
