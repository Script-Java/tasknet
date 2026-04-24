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

export interface Group {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  level: number;
  xp: number;
}

export interface UserProfile {
  username: string | null;
  level: number;
  xp: number;
  recent_completed_todos: Array<{
    id: string;
    due_date: string;
    completed_at: string;
  }>;
  recent_completed_habits: Array<{
    id: string;
    streak: number;
    last_completed_date: string;
  }>;
}
