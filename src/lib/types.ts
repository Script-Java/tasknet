export type Priority = 'low' | 'medium' | 'high';
export type Frequency = 'daily' | 'weekly' | 'custom';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  duration: number;
  priority: Priority;
  deadline?: string | null;
  created_at: string;
  completed?: boolean;
  completed_at?: string | null;
  date?: string;
  overdue?: boolean;
}

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  frequency: Frequency;
  preferred_time?: string | null;
  duration: number;
  streak?: number;
  last_completed_date?: string | null;
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

export interface HabitCompletion {
  id: string;
  habit_id: string;
  user_id: string;
  completed_at: string;
  completed_at_ts?: string | null;
}

export interface BadgeProgress {
  user_id: string;
  progress: Record<string, unknown>;
  updated_at: string;
}

export interface UserStats {
  xp: number;
  coins: number;
  level: number;
  next_level_xp: number;
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
  username: string | null;
  avatar_url: string | null;
}

export interface Group {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
  member_count?: number;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
}

export interface GroupMemberWithProfile {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  xp: number;
  level: number;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string | null;
  email: string | null;
  level: number;
  xp: number;
  avatar_url?: string | null;
}

export interface UserProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  xp: number;
  level: number;
  recent_todos: Array<{
    id: string;
    title: string;
    completed_at: string;
  }>;
  recent_habits: Array<{
    id: string;
    title: string;
    last_completed_date: string;
  }>;
}

export interface GroupMemberTask {
  user_id: string;
  username: string | null;
  task_id: string;
  title: string;
  completed: boolean;
  priority: string;
  deadline: string | null;
  duration: number;
}

export interface GroupMemberHabit {
  user_id: string;
  username: string | null;
  habit_id: string;
  title: string;
  frequency: string;
  duration: number;
  streak: number;
  last_completed_date: string | null;
}