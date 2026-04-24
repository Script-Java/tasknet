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
