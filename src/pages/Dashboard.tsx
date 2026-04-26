import { useEffect, useState, useCallback, useMemo } from 'react';
import { getAll, initDB } from '../lib/store';
import { syncWithSupabase } from '../lib/sync';
import { gamification, getTaskXp } from '../lib/gamification';
import { buildBadgeContext, evaluateBadges, unlockBadges, saveBadgeProgress } from '../lib/badgeEvaluator';
import { useBadgeContext } from '../contexts/BadgeContext';
import { BADGES } from '../lib/badges';
import type { Task, Habit, UserStats, DailyScore, Achievement } from '../lib/types';
import { RefreshCw, Flame, Star, Trophy, Zap, TrendingUp, Bell, CheckCircle, AlertTriangle, Coins, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isBefore, startOfDay } from 'date-fns';

const gradeConfig: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  A: { color: '#66BB6A', bg: 'rgba(102,187,106,0.10)', border: 'rgba(102,187,106,0.25)', glow: 'rgba(102,187,106,0.08)' },
  B: { color: '#64B5F6', bg: 'rgba(100,181,246,0.10)', border: 'rgba(100,181,246,0.25)', glow: 'rgba(100,181,246,0.08)' },
  C: { color: '#FFB74D', bg: 'rgba(255,183,77,0.10)', border: 'rgba(255,183,77,0.25)', glow: 'rgba(255,183,77,0.08)' },
  D: { color: '#EF5350', bg: 'rgba(239,83,80,0.10)', border: 'rgba(239,83,80,0.25)', glow: 'rgba(239,83,80,0.08)' },
};

export function Dashboard({ userId }: { userId: string }) {
  const { showBadge } = useBadgeContext();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [dailyScore, setDailyScore] = useState<DailyScore | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  const loadData = useCallback(async () => {
    await initDB();
    const localTasks = await getAll('tasks') as Task[];
    const localHabits = await getAll('habits') as Habit[];
    setTasks(localTasks);
    setHabits(localHabits);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const [userStats, score, achs] = await Promise.all([
        gamification.getUserStats(userId),
        gamification.getDailyScore(userId),
        gamification.getAchievements(userId),
      ]);
      setStats(userStats);
      setDailyScore(score);
      setAchievements(achs);
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
    loadStats();
    gamification.markOverdueTasks(userId).catch(() => {});
  }, [userId, loadData, loadStats]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncWithSupabase();
      await loadData();
      await loadStats();
      toast.success('Synced with cloud');
      try {
        const ctx = await buildBadgeContext(userId, 'manual');
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
      } catch {
      }
    } catch {
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const xpProgress = stats
    ? stats.next_level_xp > 0
      ? Math.round(((stats.xp - stats.level * stats.level * 10) / (stats.next_level_xp - stats.level * stats.level * 10)) * 100)
      : 0
    : 0;

  const gradeStyle = dailyScore ? gradeConfig[dailyScore.grade] : null;

  const badgeIds = useMemo(() => new Set(BADGES.map(b => b.id)), []);
  const badgeAchievements = useMemo(
    () => achievements.filter(a => badgeIds.has(a.type)),
    [achievements, badgeIds]
  );

  const overdueTasks = tasks.filter(t => !t.completed && t.deadline && isBefore(new Date(t.deadline), startOfDay(new Date())));
  const recentlyCompleted = tasks
    .filter(t => t.completed && t.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
    .slice(0, 5);

  const today = format(new Date(), 'yyyy-MM-dd');
  const uncheckedHabits = habits.filter(h => h.last_completed_date !== today);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#EEEEF8]">Dashboard</h1>
          <p className="text-[#8E89B3] mt-1 md:mt-2 text-base md:text-lg">Updates and notifications.</p>
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

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div
            className="metric-card metric-card-animate"
            style={{ animationDelay: '0ms' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="metric-icon bg-[rgba(139,92,246,0.12)]">
                <TrendingUp className="w-[18px] h-[18px] text-[#A78BFA]" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#A78BFA]/60 bg-[rgba(139,92,246,0.08)] px-2 py-0.5 rounded-full">
                Lv.{stats.level}
              </span>
            </div>
            <div className="metric-value text-[#EEEEF8]">{stats.xp.toLocaleString()}</div>
            <div className="metric-label mt-1.5">Total XP</div>
            <div className="mt-4">
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] text-[#5C5780] font-medium">Progress</span>
                <span className="text-[11px] text-[#8E89B3] font-semibold">{xpProgress}%</span>
              </div>
              <div className="galaxy-progress">
                <div className="galaxy-progress-fill" style={{ width: `${Math.min(100, Math.max(0, xpProgress))}%` }} />
              </div>
              <p className="text-[11px] text-[#5C5780] mt-1.5">{stats.next_level_xp - stats.xp} XP to level {stats.level + 1}</p>
            </div>
          </div>

          <div
            className="metric-card metric-card-animate"
            style={{ animationDelay: '75ms' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="metric-icon bg-[rgba(255,183,77,0.12)]">
                <Coins className="w-[18px] h-[18px] text-[#FFB74D]" />
              </div>
            </div>
            <div className="metric-value text-[#FFB74D]">{stats.coins.toLocaleString()}</div>
            <div className="metric-label mt-1.5">Coins Earned</div>
            <div className="mt-4 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FFB74D]/50" />
              <span className="text-[11px] text-[#5C5780]">Rewards for completed tasks</span>
            </div>
          </div>

          {dailyScore && gradeStyle ? (
            <div
              className="metric-card metric-card-animate"
              style={{
                animationDelay: '150ms',
                borderColor: gradeStyle.border,
                boxShadow: `0 0 30px ${gradeStyle.glow}, inset 0 0 30px ${gradeStyle.glow}`,
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="metric-icon" style={{ background: gradeStyle.bg }}>
                  <Star className="w-[18px] h-[18px]" style={{ color: gradeStyle.color }} />
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: gradeStyle.bg, color: gradeStyle.color }}
                >
                  Today
                </span>
              </div>
              <div className="metric-value" style={{ color: gradeStyle.color }}>
                {dailyScore.grade}
              </div>
              <div className="metric-label mt-1.5" style={{ color: gradeStyle.color + 'AA' }}>
                Daily Grade
              </div>
              <div className="mt-4">
                <div className="flex justify-between mb-1.5">
                  <span className="text-[11px] text-[#5C5780] font-medium">Score</span>
                  <span className="text-[11px] font-semibold" style={{ color: gradeStyle.color }}>{dailyScore.percentage}%</span>
                </div>
                <div className="galaxy-progress">
                  <div
                    className="galaxy-progress-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, dailyScore.percentage))}%`,
                      background: `linear-gradient(90deg, ${gradeStyle.color}88, ${gradeStyle.color})`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              className="metric-card metric-card-animate"
              style={{ animationDelay: '150ms' }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="metric-icon bg-[rgba(92,87,128,0.15)]">
                  <Star className="w-[18px] h-[18px] text-[#5C5780]" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#5C5780]/60 bg-[rgba(92,87,128,0.08)] px-2 py-0.5 rounded-full">
                  Today
                </span>
              </div>
              <div className="metric-value text-[#5C5780]">--</div>
              <div className="metric-label mt-1.5">Daily Grade</div>
              <div className="mt-4">
                <div className="galaxy-progress">
                  <div className="galaxy-progress-fill" style={{ width: '0%' }} />
                </div>
                <p className="text-[11px] text-[#5C5780] mt-1.5">Complete tasks to earn your grade</p>
              </div>
            </div>
          )}

          <div
            className="metric-card metric-card-animate"
            style={{ animationDelay: '225ms' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="metric-icon bg-[rgba(255,183,77,0.12)]">
                <Trophy className="w-[18px] h-[18px] text-[#FFB74D]" />
              </div>
            </div>
            <div className="metric-value text-[#EEEEF8]">{badgeAchievements.length}</div>
            <div className="metric-label mt-1.5">Achievements</div>
            <div className="mt-4 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#5C5780]" />
              <span className="text-[11px] text-[#5C5780]">
                {badgeAchievements.length === 0 ? 'Start completing tasks to unlock' : `${badgeAchievements.length} of ${BADGES.length} unlocked`}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <div className="galaxy-card p-4 md:p-6">
          <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center space-x-2 text-[#EEEEF8]">
            <Bell className="w-5 h-5 text-[#A78BFA]" />
            <span>Notifications</span>
          </h3>
          <div className="space-y-3">
            {overdueTasks.length > 0 && (
              <div className="flex items-start space-x-3 p-3 bg-[rgba(239,83,80,0.08)] rounded-xl border border-[rgba(239,83,80,0.2)]">
                <AlertTriangle className="w-5 h-5 text-[#EF5350] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[#EEEEF8]">{overdueTasks.length} overdue {overdueTasks.length === 1 ? 'task' : 'tasks'}</p>
                  <p className="text-xs text-[#8E89B3] mt-0.5">Head to Tasks to catch up.</p>
                </div>
              </div>
            )}

            {uncheckedHabits.length > 0 && (
              <div className="flex items-start space-x-3 p-3 bg-[rgba(139,92,246,0.08)] rounded-xl border border-[rgba(139,92,246,0.2)]">
                <Flame className="w-5 h-5 text-[#A78BFA] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[#EEEEF8]">{uncheckedHabits.length} habit{uncheckedHabits.length === 1 ? '' : 's'} waiting</p>
                  <p className="text-xs text-[#8E89B3] mt-0.5">Check in to keep your streak alive.</p>
                </div>
              </div>
            )}

            {overdueTasks.length === 0 && uncheckedHabits.length === 0 && (
              <div className="flex items-start space-x-3 p-3 bg-[rgba(102,187,106,0.08)] rounded-xl border border-[rgba(102,187,106,0.2)]">
                <CheckCircle className="w-5 h-5 text-[#66BB6A] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[#EEEEF8]">All caught up!</p>
                  <p className="text-xs text-[#8E89B3] mt-0.5">No pending notifications right now.</p>
                </div>
              </div>
            )}

            {badgeAchievements.length > 0 && (
              <div className="flex items-start space-x-3 p-3 bg-[rgba(255,183,77,0.08)] rounded-xl border border-[rgba(255,183,77,0.2)]">
                <Trophy className="w-5 h-5 text-[#FFB74D] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[#EEEEF8]">{badgeAchievements.length} badge{badgeAchievements.length === 1 ? '' : 's'} earned</p>
                  <p className="text-xs text-[#8E89B3] mt-0.5">Visit your Profile to see them all.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="galaxy-card p-4 md:p-6">
          <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center space-x-2 text-[#EEEEF8]">
            <Zap className="w-5 h-5 text-[#64B5F6]" />
            <span>Recent Activity</span>
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {recentlyCompleted.length > 0 ? (
              recentlyCompleted.map(task => {
                const xp = getTaskXp(task.priority);
                const priorityColors: Record<string, string> = {
                  high: 'text-[#EF5350]',
                  medium: 'text-[#FFB74D]',
                  low: 'text-[#66BB6A]',
                };
                return (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-[rgba(13,11,30,0.4)] rounded-xl border border-[#2A2545]">
                    <div className="flex items-center space-x-3 overflow-hidden min-w-0">
                      <div className="galaxy-check checked flex-shrink-0">
                        <Star className="w-3.5 h-3.5 text-white" />
                      </div>
                      <p className="text-sm text-[#EEEEF8] truncate">{task.title}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={`text-[10px] font-semibold uppercase ${priorityColors[task.priority] || 'text-[#8E89B3]'}`}>
                        +{xp}xp
                      </span>
                      <span className="text-xs text-[#5C5780]">
                        {task.completed_at ? format(new Date(task.completed_at), 'MMM d') : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-[#5C5780] text-center py-8">No recent activity yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
