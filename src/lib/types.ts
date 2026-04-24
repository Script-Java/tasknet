export type Priority = 'low' | 'medium' | 'high';
export type Frequency = 'daily' | 'weekly' | 'custom';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  duration: number; // in minutes
  priority: Priority;
  deadline?: string | null;
  created_at: string;
  completed?: boolean;
  is_focus?: boolean;
}

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  frequency: Frequency;
  preferred_time?: string | null;
  duration: number;
}

export interface CalendarEntry {
  id: string;
  user_id: string;
  task_id?: string;
  habit_id?: string;
  start_time: string;
  end_time: string;
}

export type ActionType = 'INSERT' | 'UPDATE' | 'DELETE';
export type TableName = 'tasks' | 'habits' | 'calendar_entries';

export interface PendingChange {
  id: string;
  table: TableName;
  action: ActionType;
  record_id: string;
  data?: any;
  timestamp: string;
}

export interface UserProgress {
  xp: number;
  level: number;
  next_level_xp: number;
  title: string;
}

export interface MicroFeedback {
  xp_gained: number;
  coins_gained: number;
  streak_updated: boolean;
  new_streak?: number;
}

export interface WeeklySummary {
  xp_gained: number;
  todos_completed: number;
  habits_completed: number;
  highest_streak: number;
}

export interface GroupLeaderboardEntry {
  user_id: string;
  xp: number;
  tasks_completed_today: number;
  last_active_date: string;
}

export interface GroupRanking {
  rank: number;
  xp_difference_above: number;
  xp_difference_below: number;
}

export interface GroupLeaderboardData {
  ranking: GroupRanking;
  leaderboard: GroupLeaderboardEntry[];
}

export interface DailyScore {
  percentage: number;
  grade: 'A' | 'B' | 'C' | 'D';
}

export interface Achievement {
  id: string;
  user_id: string;
  type: string;
  unlocked_at: string;
}

export interface GamificationUser {
  id: string;
  xp: number;
  coins: number;
}
