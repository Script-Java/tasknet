import {
  format,
  parseISO,
  subDays,
  addDays,
  getDay,
  getHours,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isWithinInterval,
  differenceInDays,
} from 'date-fns';
import { supabase } from './supabase';
import { BADGES, type BadgeTrigger } from './badges';
import type { UserStats, Task, Habit, HabitCompletion, GroupMember, LeaderboardEntry } from './types';
import { initDB, getAll } from './store';

export interface BadgeCheckContext {
  userId: string;
  trigger: BadgeTrigger;
  now: Date;
  stats: UserStats;
  tasks: Task[];
  habits: Habit[];
  habitCompletions: HabitCompletion[];
  achievements: Set<string>;
  groups: { id: string; members: GroupMember[] }[];
  leaderboard: LeaderboardEntry[];
  progress: Record<string, unknown>;
  xpDelta: number;
  previousHabitState?: { id: string; streak: number; last_completed_date: string | null };
  lastAction?: { type: 'task' | 'habit'; id: string; completedAt: Date };
}

export interface BadgeEvaluationResult {
  unlocked: string[];
  progressUpdates: Record<string, unknown>;
}

/* ============================================================
   Public API
   ============================================================ */

export async function evaluateBadges(ctx: BadgeCheckContext): Promise<BadgeEvaluationResult> {
  const unlocked: string[] = [];
  const progress: Record<string, unknown> = { ...ctx.progress };

  for (const badge of BADGES) {
    if (ctx.achievements.has(badge.id)) continue;
    if (!badge.triggers.includes(ctx.trigger) && ctx.trigger !== 'manual') continue;

    const check = CHECKS[badge.id];
    if (!check) continue;

    const passed = await check(ctx, progress);
    if (passed) {
      unlocked.push(badge.id);
    }
  }

  if (ctx.trigger === 'leaderboard_update' || ctx.trigger === 'manual') {
    progress.previous_leaderboard = ctx.leaderboard;
    const you = ctx.leaderboard.find((e) => e.user_id === ctx.userId);
    if (you) {
      const weekKey = format(startOfWeek(ctx.now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      progress[`week_rank_${weekKey}`] = you.rank;
    }
  }

  const progressUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(progress)) {
    if (ctx.progress[key] !== value) {
      progressUpdates[key] = value;
    }
  }

  return { unlocked, progressUpdates };
}

export async function unlockBadges(userId: string, badgeIds: string[]): Promise<void> {
  if (badgeIds.length === 0) return;
  const rows = badgeIds.map((id) => ({ user_id: userId, type: id }));
  const { error } = await supabase.from('achievements').insert(rows);
  if (error) throw error;
}

export async function saveBadgeProgress(userId: string, updates: Record<string, unknown>): Promise<void> {
  if (Object.keys(updates).length === 0) return;
  const { data } = await supabase
    .from('user_badge_progress')
    .select('progress')
    .eq('user_id', userId)
    .single();
  const current = (data?.progress as Record<string, unknown>) || {};
  const next = { ...current, ...updates };
  const { error } = await supabase.from('user_badge_progress').upsert({
    user_id: userId,
    progress: next,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function buildBadgeContext(
  userId: string,
  trigger: BadgeTrigger,
  opts?: {
    groupId?: string;
    xpDelta?: number;
    previousHabitState?: BadgeCheckContext['previousHabitState'];
    lastAction?: BadgeCheckContext['lastAction'];
  }
): Promise<BadgeCheckContext> {
  const now = new Date();

  const [statsRes, tasksRes, habitsRes, completionsRes, achievementsRes, progressRes] = await Promise.all([
    supabase.rpc('get_user_stats', { p_user_id: userId }),
    supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('habits').select('*').eq('user_id', userId),
    supabase
      .from('habit_completions')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(500),
    supabase.from('achievements').select('type').eq('user_id', userId),
    supabase.from('user_badge_progress').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  const stats = (statsRes.data as unknown as UserStats) || { xp: 0, coins: 0, level: 0, next_level_xp: 0 };
  const remoteTasks = (tasksRes.data as Task[]) || [];
  const remoteHabits = (habitsRes.data as Habit[]) || [];
  const habitCompletions = (completionsRes.data as HabitCompletion[]) || [];
  const achievements = new Set<string>(((achievementsRes.data as { type: string }[]) || []).map((a) => a.type));
  const progress = (progressRes.data?.progress as Record<string, unknown>) || {};

  // Merge local IndexedDB data with Supabase data.
  // Local data takes precedence for completion status since sync may lag.
  let mergedTasks = remoteTasks;
  let mergedHabits = remoteHabits;
  try {
    await initDB();
    const [localTasks, localHabits] = await Promise.all([
      getAll('tasks') as Promise<Task[]>,
      getAll('habits') as Promise<Habit[]>,
    ]);
    mergedTasks = mergeById(remoteTasks, localTasks);
    mergedHabits = mergeById(remoteHabits, localHabits);
  } catch {
    // Fall back to Supabase data only
  }

  let groups: BadgeCheckContext['groups'] = [];
  let leaderboard: LeaderboardEntry[] = [];

  const needsSocial =
    trigger === 'friend_add' ||
    trigger === 'leaderboard_update' ||
    trigger === 'xp_change' ||
    trigger === 'manual';

  if (needsSocial) {
    const { data: memberOf } = await supabase.from('group_members').select('group_id').eq('user_id', userId);
    if (memberOf && memberOf.length > 0) {
      const groupIds = memberOf.map((m: { group_id: string }) => m.group_id);
      const { data: groupsData } = await supabase.from('groups').select('*').in('id', groupIds);
      const { data: allMembers } = await supabase.from('group_members').select('*').in('group_id', groupIds);
      for (const g of groupsData || []) {
        groups.push({
          id: g.id,
          members: (allMembers || []).filter((m: GroupMember) => m.group_id === g.id),
        });
      }
      const targetGroupId = opts?.groupId || groupIds[0];
      const { data: lb } = await supabase.rpc('get_group_members_leaderboard', { p_group_id: targetGroupId });
      leaderboard = (lb as LeaderboardEntry[]) || [];
    }
  }

  return {
    userId,
    trigger,
    now,
    stats,
    tasks: mergedTasks,
    habits: mergedHabits,
    habitCompletions,
    achievements,
    groups,
    leaderboard,
    progress,
    xpDelta: opts?.xpDelta || 0,
    previousHabitState: opts?.previousHabitState,
    lastAction: opts?.lastAction,
  };
}

/**
 * Merge two arrays of objects by `id`. Local entries take precedence
 * (they reflect user actions not yet synced to the server).
 */
function mergeById<T extends { id: string }>(remote: T[], local: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of remote) {
    map.set(item.id, item);
  }
  for (const item of local) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

/* ============================================================
   Check Implementations
   ============================================================ */

const CHECKS: Record<
  string,
  (ctx: BadgeCheckContext, progress: Record<string, unknown>) => boolean | Promise<boolean>
> = {
  first_light: (ctx) => {
    return ctx.tasks.some((t) => t.completed) || ctx.habitCompletions.length > 0;
  },

  orbit_established: (ctx) => {
    const dailyHabits = ctx.habits.filter((h) => h.frequency === 'daily');
    if (dailyHabits.length === 0) return false;
    const dateCount = buildDateCount(ctx.habitCompletions);
    for (let i = 0; i < 7; i++) {
      const d = format(subDays(ctx.now, i), 'yyyy-MM-dd');
      if ((dateCount.get(d) || 0) < dailyHabits.length) return false;
    }
    return true;
  },

  lunar_cycle: (ctx) => {
    const dailyHabits = ctx.habits.filter((h) => h.frequency === 'daily');
    if (dailyHabits.length === 0) return false;
    const dateCount = buildDateCount(ctx.habitCompletions);
    for (let i = 0; i < 30; i++) {
      const d = format(subDays(ctx.now, i), 'yyyy-MM-dd');
      if ((dateCount.get(d) || 0) < dailyHabits.length) return false;
    }
    return true;
  },

  solar_flare: (ctx) => {
    const today = format(ctx.now, 'yyyy-MM-dd');
    const count = ctx.tasks.filter((t) => t.completed && t.completed_at && t.completed_at.startsWith(today)).length;
    return count >= 10;
  },

  unbroken_chain: (ctx) => {
    return ctx.habits.some((h) => (h.streak || 0) >= 100);
  },

  the_perfect_week: (ctx) => {
    if (getDay(ctx.now) !== 0) return false;
    const monday = startOfWeek(ctx.now, { weekStartsOn: 1 });
    const sunday = endOfWeek(ctx.now, { weekStartsOn: 1 });
    const weekTasks = ctx.tasks.filter((t) => {
      if (!t.deadline) return false;
      const d = parseISO(t.deadline);
      return isWithinInterval(d, { start: monday, end: sunday });
    });
    if (weekTasks.some((t) => !t.completed)) return false;
    const dailyHabits = ctx.habits.filter((h) => h.frequency === 'daily');
    if (dailyHabits.length === 0) return false;
    const dateCount = buildDateCount(ctx.habitCompletions);
    const days = eachDayOfInterval({ start: monday, end: sunday });
    for (const day of days) {
      const d = format(day, 'yyyy-MM-dd');
      if ((dateCount.get(d) || 0) < dailyHabits.length) return false;
    }
    return true;
  },

  night_owl: (ctx, progress) => {
    let count = (progress.night_owl_count as number) || 0;
    if (ctx.trigger === 'task_complete' || ctx.trigger === 'habit_complete') {
      if (ctx.lastAction && isNightOwlHour(ctx.lastAction.completedAt)) {
        count++;
        progress.night_owl_count = count;
      }
    } else if (ctx.trigger === 'manual') {
      const taskCount = ctx.tasks.filter(
        (t) => t.completed && t.completed_at && isNightOwlHour(parseISO(t.completed_at))
      ).length;
      const habitCount = ctx.habitCompletions.filter(
        (hc) => hc.completed_at_ts && isNightOwlHour(parseISO(hc.completed_at_ts))
      ).length;
      count = taskCount + habitCount;
      progress.night_owl_count = count;
    }
    return count >= 50;
  },

  early_riser: (ctx, progress) => {
    let count = (progress.early_riser_count as number) || 0;
    if (ctx.trigger === 'habit_complete' && ctx.lastAction?.type === 'habit') {
      const d = ctx.lastAction.completedAt;
      if (getHours(d) < 6) {
        const dayStr = format(d, 'yyyy-MM-dd');
        const earlier = ctx.habitCompletions.some(
          (hc) =>
            hc.habit_id !== ctx.lastAction!.id &&
            hc.completed_at === dayStr &&
            hc.completed_at_ts &&
            parseISO(hc.completed_at_ts).getTime() < d.getTime()
        );
        if (!earlier) {
          count++;
          progress.early_riser_count = count;
        }
      }
    } else if (ctx.trigger === 'manual') {
      const byDate = new Map<string, Date[]>();
      for (const hc of ctx.habitCompletions) {
        if (!hc.completed_at_ts) continue;
        const list = byDate.get(hc.completed_at) || [];
        list.push(parseISO(hc.completed_at_ts));
        byDate.set(hc.completed_at, list);
      }
      count = 0;
      for (const [, times] of byDate) {
        times.sort((a, b) => a.getTime() - b.getTime());
        if (getHours(times[0]) < 6) count++;
      }
      progress.early_riser_count = count;
    }
    return count >= 10;
  },

  stardust: (ctx) => ctx.stats.xp >= 1000,
  nebula: (ctx) => ctx.stats.xp >= 10000,
  supernova: (ctx) => ctx.stats.xp >= 100000,

  xp_multiplier: (ctx, progress) => {
    const todayKey = format(ctx.now, 'yyyy-MM-dd');
    const key = `daily_xp_${todayKey}`;
    let dailyXp = (progress[key] as number) || 0;
    if (ctx.trigger === 'task_complete' || ctx.trigger === 'habit_complete' || ctx.trigger === 'xp_change') {
      dailyXp += ctx.xpDelta;
      progress[key] = dailyXp;
    }
    return dailyXp > 500;
  },

  taskmaster: (ctx) => {
    const taskXp = ctx.tasks.filter((t) => t.completed).length * 10;
    return taskXp >= 5000;
  },

  constellation_connected: (ctx) => {
    const friendIds = new Set<string>();
    for (const g of ctx.groups) {
      for (const m of g.members) {
        if (m.user_id !== ctx.userId) friendIds.add(m.user_id);
      }
    }
    return friendIds.size >= 5;
  },

  friendly_rivalry: (ctx) => {
    const prev = (ctx.progress.previous_leaderboard as LeaderboardEntry[]) || [];
    const prevYou = prev.find((e) => e.user_id === ctx.userId);
    const currYou = ctx.leaderboard.find((e) => e.user_id === ctx.userId);
    if (!prevYou || !currYou) return false;
    for (const friend of prev) {
      if (friend.user_id === ctx.userId) continue;
      const currFriend = ctx.leaderboard.find((e) => e.user_id === friend.user_id);
      if (!currFriend) continue;
      if (friend.rank < prevYou.rank && currYou.rank < currFriend.rank) {
        return true;
      }
    }
    return false;
  },

  apex_star: (ctx) => {
    if (getDay(ctx.now) !== 0) return false;
    const you = ctx.leaderboard.find((e) => e.user_id === ctx.userId);
    return you?.rank === 1;
  },

  podium_finish: (ctx, progress) => {
    if (getDay(ctx.now) !== 0) return false;
    const you = ctx.leaderboard.find((e) => e.user_id === ctx.userId);
    if (!you || you.rank > 3) {
      progress.consecutive_top3_weeks = 0;
      return false;
    }
    const current = ((progress.consecutive_top3_weeks as number) || 0) + 1;
    progress.consecutive_top3_weeks = current;
    return current >= 4;
  },

  the_pacesetter: (ctx, progress) => {
    const milestones = [1000, 10000, 100000];
    const checked = new Set<string>((progress.pacesetter_milestones as string[]) || []);
    for (const m of milestones) {
      if (ctx.stats.xp >= m && !checked.has(String(m))) {
        const anyoneElse = ctx.leaderboard.some((e) => e.user_id !== ctx.userId && e.xp >= m);
        if (!anyoneElse) {
          checked.add(String(m));
          progress.pacesetter_milestones = Array.from(checked);
          return true;
        }
      }
    }
    return false;
  },

  accountability_partner: async (ctx) => {
    if (ctx.groups.length === 0) return false;
    try {
      const { data } = await supabase.rpc('check_accountability_partner', { p_user_id: ctx.userId });
      return data === true;
    } catch {
      return false;
    }
  },

  underdog_victory: (ctx, progress) => {
    if (getDay(ctx.now) !== 0) return false;
    const you = ctx.leaderboard.find((e) => e.user_id === ctx.userId);
    if (!you) return false;
    const total = ctx.leaderboard.length;
    const weekKey = format(startOfWeek(ctx.now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekStartRank = progress[`week_rank_${weekKey}`] as number;
    if (!weekStartRank) return false;
    return weekStartRank > total / 2 && you.rank <= 3;
  },

  eclipse_survivor: (ctx, progress) => {
    if (ctx.trigger === 'habit_complete' && ctx.previousHabitState) {
      const { streak, last_completed_date } = ctx.previousHabitState;
      if (streak >= 14 && last_completed_date) {
        const daysSince = differenceInDays(ctx.now, parseISO(last_completed_date));
        if (daysSince > 1) {
          progress.eclipse_survivor_eligible = true;
          progress.eclipse_survivor_habit_id = ctx.previousHabitState.id;
        }
      }
    }
    if (progress.eclipse_survivor_eligible) {
      const habit = ctx.habits.find((h) => h.id === progress.eclipse_survivor_habit_id);
      if (habit && (habit.streak || 0) >= 7) {
        progress.eclipse_survivor_eligible = false;
        return true;
      }
    }
    return false;
  },

  meteor_shower: (ctx) => {
    const day = getDay(ctx.now);
    const daysSinceSat = (day + 1) % 7;
    const sat = subDays(ctx.now, daysSinceSat);
    const sun = addDays(sat, 1);
    const satStr = format(sat, 'yyyy-MM-dd');
    const sunStr = format(sun, 'yyyy-MM-dd');
    const taskCount = ctx.tasks.filter((t) => {
      if (!t.completed) return false;
      if (t.completed_at) {
        const d = t.completed_at.slice(0, 10);
        return d === satStr || d === sunStr;
      }
      return false;
    }).length;
    const habitCount = ctx.habitCompletions.filter(
      (hc) => hc.completed_at === satStr || hc.completed_at === sunStr
    ).length;
    return taskCount + habitCount >= 20;
  },

  cosmic_journey: (ctx) => {
    const tasksCompleted = ctx.tasks.filter((t) => t.completed).length;
    const habitsCompleted = ctx.habitCompletions.length;
    return tasksCompleted + habitsCompleted >= 1000;
  },
};

/* ============================================================
   Helpers
   ============================================================ */

function buildDateCount(completions: HabitCompletion[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of completions) {
    map.set(c.completed_at, (map.get(c.completed_at) || 0) + 1);
  }
  return map;
}

function isNightOwlHour(date: Date): boolean {
  const h = date.getHours();
  return h >= 22 || h < 2;
}