import { describe, it, expect } from 'vitest';
import { scheduleTasksAndHabits } from './lib/scheduler';
import type { Task, Habit } from './lib/types';

describe('scheduleTasksAndHabits', () => {
  it('should schedule tasks and avoid overlaps', () => {
    const tasks: Task[] = [
      { id: '1', user_id: 'u1', title: 'Task 1', duration: 60, priority: 'high', created_at: new Date().toISOString() },
      { id: '2', user_id: 'u1', title: 'Task 2', duration: 30, priority: 'low', created_at: new Date().toISOString() }
    ];
    const habits: Habit[] = [];

    // Use a fixed start day to avoid timezone/time-of-day execution issues
    const startDay = new Date('2026-05-01T08:00:00Z');

    const entries = scheduleTasksAndHabits(tasks, habits, 'u1', startDay);

    expect(entries.length).toBe(2);
    // Highest priority should be scheduled first
    expect(entries[0].task_id).toBe('1');
    expect(entries[1].task_id).toBe('2');

    // Ensure they don't overlap
    const end1 = new Date(entries[0].end_time);
    const start2 = new Date(entries[1].start_time);
    expect(start2.getTime()).toBeGreaterThanOrEqual(end1.getTime());
  });
});
