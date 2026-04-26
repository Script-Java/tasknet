import { useEffect, useState, useCallback } from 'react';
import { NaturalInput } from '../components/NaturalInput';
import { HabitForm } from '../components/HabitForm';
import { getAll, initDB, deleteRecord, upsertRecord } from '../lib/store';
import { syncWithSupabase } from '../lib/sync';
import { gamification } from '../lib/gamification';
import { buildBadgeContext, evaluateBadges, unlockBadges, saveBadgeProgress } from '../lib/badgeEvaluator';
import { useBadgeContext } from '../contexts/BadgeContext';
import type { Habit } from '../lib/types';
import { Trash2, Check, Flame, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export function HabitsPage({ userId }: { userId: string }) {
  const { showBadge } = useBadgeContext();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingHabitId, setSyncingHabitId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    await initDB();
    const localHabits = await getAll('habits') as Habit[];
    setHabits(localHabits);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runBadgeCheck = async (
    trigger: 'habit_complete' | 'manual' | 'task_complete' | 'xp_change' | 'friend_add' | 'leaderboard_update',
    opts?: Parameters<typeof buildBadgeContext>[2]
  ) => {
    try {
      const ctx = await buildBadgeContext(userId, trigger, opts);
      const result = await evaluateBadges(ctx);
      if (result.unlocked.length > 0) {
        await unlockBadges(userId, result.unlocked);
        for (const badgeId of result.unlocked) {
          showBadge(badgeId);
        }
      }
      if (Object.keys(result.progressUpdates).length > 0) {
        await saveBadgeProgress(userId, result.progressUpdates);
      }
    } catch (e) {
      console.error('Badge check failed:', e);
    }
  };

  const handleCompleteHabit = async (habit: Habit) => {
    const today = new Date().toISOString().split('T')[0];

    if (habit.last_completed_date === today) {
      toast('Already completed today!');
      return;
    }

    setSyncingHabitId(habit.id);

    try { await syncWithSupabase(); } catch {}

    const updatedHabit: Habit = {
      ...habit,
      streak: (habit.streak || 0) + 1,
      last_completed_date: today,
    };

    await upsertRecord('habits', updatedHabit);

    const currentStreak = (habit.streak || 0) + 1;
    const habitXp = currentStreak > 3 ? 20 : 15;
    toast.success(`Habit completed! +${habitXp} XP`, { icon: '🔥' });

    try {
      await gamification.completeHabit(habit.id);
      await runBadgeCheck('habit_complete', {
        xpDelta: 3,
        lastAction: { type: 'habit', id: habit.id, completedAt: new Date() },
      });
    } catch {
      // Will sync on next full sync
    } finally {
      setSyncingHabitId(null);
    }

    await loadData();
  };

  const handleDeleteHabit = async (id: string) => {
    if (!confirm('Delete this habit?')) return;
    await deleteRecord('habits', id);
    await loadData();
    toast.success('Habit deleted');
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncWithSupabase();
      await loadData();
      toast.success('Synced with cloud');
      await runBadgeCheck('manual');
    } catch {
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#EEEEF8]">Habits</h1>
          <p className="text-[#8E89B3] mt-1 md:mt-2 text-base md:text-lg">Build consistency that stays with you.</p>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-[rgba(21,18,42,0.75)] border border-[#2A2545] rounded-xl text-sm font-semibold text-[#8E89B3] hover:bg-[rgba(30,26,58,0.75)] transition shadow-sm disabled:opacity-50 backdrop-blur-md self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#A78BFA]' : ''}`} />
          <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </div>

      <div className="max-w-2xl">
        <NaturalInput userId={userId} onSaved={loadData} />
      </div>

      <div className="max-w-2xl">
        <HabitForm userId={userId} onSaved={loadData} />

        <div className="galaxy-card p-4 md:p-6 rounded-3xl mt-6 md:mt-8">
          <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center justify-between text-[#EEEEF8]">
            Your Habits
            <span className="bg-[rgba(139,92,246,0.2)] text-[#A78BFA] py-0.5 px-2.5 rounded-full text-sm font-medium">
              {habits.length}
            </span>
          </h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {habits.map(habit => {
              const isCompletedToday = habit.last_completed_date === today;
              const isSyncingThis = syncingHabitId === habit.id;

              return (
                <div key={habit.id} className="group flex items-center justify-between p-3 md:p-4 bg-[rgba(21,18,42,0.6)] rounded-2xl border border-[#2A2545] hover:border-[#8B5CF6]/50 transition-colors">
                  <div className="flex items-center space-x-3 overflow-hidden min-w-0">
                    <button
                      onClick={() => handleCompleteHabit(habit)}
                      disabled={isSyncingThis}
                      className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        isCompletedToday
                          ? 'bg-[#8B5CF6] border-2 border-[#A78BFA]'
                          : 'border-2 border-[#2A2545] hover:border-[#8B5CF6]'
                      } ${isSyncingThis ? 'opacity-50' : ''}`}
                    >
                      {isSyncingThis ? (
                        <div className="w-3 h-3 border-2 border-[#A78BFA] border-t-transparent rounded-full animate-spin" />
                      ) : isCompletedToday ? (
                        <Check className="w-4 h-4 text-white" />
                      ) : null}
                    </button>
                    <div className="overflow-hidden min-w-0">
                      <p className="font-medium text-[#EEEEF8] truncate">{habit.title}</p>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-xs text-[#5C5780] capitalize">{habit.frequency} &bull; {habit.duration}m</span>
                        {habit.streak !== undefined && habit.streak > 0 && (
                          <>
                            <span className="w-1 h-1 bg-[#2A2545] rounded-full hidden sm:inline-block" />
                            <span className="text-xs text-[#FFB74D] flex items-center space-x-1">
                              <Flame className="w-3 h-3" />
                              <span>{habit.streak}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteHabit(habit.id)} className="sm:opacity-0 sm:group-hover:opacity-100 p-2 text-[#5C5780] hover:text-red-400 transition-all flex-shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
            {habits.length === 0 && (
              <p className="text-[#8E89B3] text-center py-8">No habits yet. Start building your routine!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}