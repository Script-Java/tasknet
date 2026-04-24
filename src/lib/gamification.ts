import { supabase } from './supabase';
import type { DailyScore, UserProgress, MicroFeedback, WeeklySummary, GroupLeaderboardData } from './types';

export const gamification = {
  async completeTodo(todoId: string): Promise<MicroFeedback> {
    const { data, error } = await supabase.rpc('complete_todo', { p_todo_id: todoId });
    if (error) throw error;
    return data as unknown as MicroFeedback;
  },

  async completeHabit(habitId: string): Promise<MicroFeedback> {
    const { data, error } = await supabase.rpc('complete_habit', { p_habit_id: habitId });
    if (error) throw error;
    return data as unknown as MicroFeedback;
  },

  async markOverdueTodos(userId: string): Promise<{missed_tasks_count: number, xp_lost: number}> {
    const { data, error } = await supabase.rpc('mark_overdue_todos_with_feedback', { p_user_id: userId });
    if (error) throw error;
    return data as unknown as {missed_tasks_count: number, xp_lost: number};
  },

  async getConsistencyScore(userId: string): Promise<number> {
    const { data, error } = await supabase.rpc('get_consistency_score', { p_user_id: userId });
    if (error) throw error;
    return data as number;
  },

  async getStreakRisk(userId: string): Promise<Record<string, boolean>> {
    const { data, error } = await supabase.rpc('get_streak_risk', { p_user_id: userId });
    if (error) throw error;
    return data as Record<string, boolean>;
  },

  async getWeeklySummary(userId: string): Promise<WeeklySummary> {
    const { data, error } = await supabase.rpc('get_weekly_summary', { p_user_id: userId });
    if (error) throw error;
    return data as unknown as WeeklySummary;
  },

  async getGroupLeaderboard(groupId: string, userId: string): Promise<GroupLeaderboardData> {
    const { data, error } = await supabase.rpc('get_group_leaderboard', { p_group_id: groupId, p_user_id: userId });
    if (error) throw error;
    return data as unknown as GroupLeaderboardData;
  },

  async getDailyScore(userId: string, date: string): Promise<DailyScore> {
    const { data, error } = await supabase.rpc('get_daily_score', {
      p_user_id: userId,
      p_date: date,
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
  }
};
