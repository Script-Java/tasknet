import { supabase } from './supabase';
import type { DailyScore, UserProgress, UserStats, Achievement } from './types';
import type { Priority } from './types';

function formatRpcDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calcLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 10));
}

function calcNextLevelXp(level: number): number {
  return (level + 1) * (level + 1) * 10;
}

const PRIORITY_XP: Record<Priority, number> = {
  low: 5,
  medium: 10,
  high: 15,
};

const PRIORITY_COINS: Record<Priority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export function getTaskXp(priority: Priority): number {
  return PRIORITY_XP[priority] || 10;
}

export function getTaskCoins(priority: Priority): number {
  return PRIORITY_COINS[priority] || 2;
}

export const gamification = {
  async completeTask(taskId: string): Promise<void> {
    const { error } = await supabase.rpc('complete_task', { p_task_id: taskId });
    if (error) throw error;
  },

  async completeHabit(habitId: string): Promise<void> {
    const { error } = await supabase.rpc('complete_habit', { p_habit_id: habitId });
    if (error) throw error;
  },

  async deleteTaskAndRevokeXp(taskId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_task_and_revoke_xp', { p_task_id: taskId });
    if (error) throw error;
  },

  async markOverdueTasks(userId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_overdue_tasks', { p_user_id: userId });
    if (error) throw error;
  },

  async getDailyScore(userId: string, date?: Date): Promise<DailyScore> {
    const d = date ? formatRpcDate(date) : formatRpcDate(new Date());
    const { data, error } = await supabase.rpc('get_daily_score', {
      p_user_id: userId,
      p_date: d,
    });
    if (error) throw error;
    return data as unknown as DailyScore;
  },

  async getUserProgress(userId: string): Promise<UserProgress> {
    const { data, error } = await supabase.rpc('get_user_progress', {
      p_user_id: userId,
    });
    if (error) throw error;
    return data as unknown as UserProgress;
  },

  async getUserStats(userId: string): Promise<UserStats> {
    const { data, error } = await supabase.rpc('get_user_stats', {
      p_user_id: userId,
    });
    if (error) throw error;
    return data as unknown as UserStats;
  },

  async getAchievements(userId: string): Promise<Achievement[]> {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });
    if (error) throw error;
    return data as Achievement[];
  },

  async getHabitStreaks(userId: string): Promise<{ id: string; streak: number; last_completed_date: string | null }[]> {
    const { data, error } = await supabase
      .from('habits')
      .select('id, streak, last_completed_date')
      .eq('user_id', userId);
    if (error) throw error;
    return data || [];
  },

  calcLevel,
  calcNextLevelXp,
};