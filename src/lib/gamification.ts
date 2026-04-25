import { supabase } from './supabase';
import type { DailyScore, UserProgress } from './types';

export const gamification = {
  async completeTodo(todoId: string): Promise<void> {
    const { error } = await supabase.rpc('complete_todo', { p_todo_id: todoId });
    if (error) throw error;
  },

  async completeHabit(habitId: string): Promise<void> {
    const { error } = await supabase.rpc('complete_habit', { p_habit_id: habitId });
    if (error) throw error;
  },

  async markOverdueTodos(userId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_overdue_todos', { p_user_id: userId });
    if (error) throw error;
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
