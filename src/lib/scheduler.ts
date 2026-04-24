import type { Task, Habit, CalendarEntry } from './types';
import { v4 as uuidv4 } from 'uuid';
import { addMinutes, startOfDay, isAfter } from 'date-fns';

export function scheduleTasksAndHabits(
  tasks: Task[],
  habits: Habit[],
  userId: string,
  startDay: Date = new Date()
): CalendarEntry[] {
  const entries: CalendarEntry[] = [];

  // Basic settings: work from 9 AM to 5 PM
  const workStartHour = 9;
  const workEndHour = 17;

  // Filter out completed tasks and sort them
  const pendingTasks = tasks.filter(t => !t.completed);

  // Sort tasks: Priority (High > Medium > Low), then Deadline
  const priorityWeight = { high: 3, medium: 2, low: 1 };

  pendingTasks.sort((a, b) => {
    if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    }
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  let currentSlot = startOfDay(startDay);
  currentSlot.setHours(workStartHour, 0, 0, 0);

  // Helper to find next available slot
  const findNextSlot = (durationMin: number, startFrom: Date) => {
    const slot = new Date(startFrom);
    if (slot.getHours() >= workEndHour) {
      // Move to next day
      slot.setDate(slot.getDate() + 1);
      slot.setHours(workStartHour, 0, 0, 0);
    } else if (slot.getHours() < workStartHour) {
      slot.setHours(workStartHour, 0, 0, 0);
    }

    // Check if slot + duration exceeds work end
    const slotEnd = addMinutes(slot, durationMin);
    const endOfDayHour = new Date(slot);
    endOfDayHour.setHours(workEndHour, 0, 0, 0);

    if (isAfter(slotEnd, endOfDayHour)) {
        // Move to next day
        slot.setDate(slot.getDate() + 1);
        slot.setHours(workStartHour, 0, 0, 0);
    }

    return slot;
  };

  // Schedule habits first (simulate daily habits for the next 7 days for now)
  for (let i = 0; i < 7; i++) {
    const day = new Date(startDay);
    day.setDate(day.getDate() + i);

    for (const habit of habits) {
        // If daily or we want to expand logic for weekly, put it at start of day for simplicity
        let slot = new Date(day);
        slot.setHours(workStartHour, 0, 0, 0);

        // Find non-overlapping slot (simplistic)
        let conflict = true;
        while (conflict) {
            const slotEnd = addMinutes(slot, habit.duration);
            conflict = entries.some(e => {
                const eStart = new Date(e.start_time);
                const eEnd = new Date(e.end_time);
                return (slot < eEnd && slotEnd > eStart);
            });
            if (conflict) {
                slot = addMinutes(slot, 30);
            }
        }

        const end_time = addMinutes(slot, habit.duration);
        entries.push({
            id: uuidv4(),
            user_id: userId,
            habit_id: habit.id,
            start_time: slot.toISOString(),
            end_time: end_time.toISOString()
        });
    }
  }

  // Schedule tasks
  currentSlot = new Date(startDay);
  if (currentSlot.getHours() < workStartHour) currentSlot.setHours(workStartHour, 0, 0, 0);

  for (const task of pendingTasks) {
    let conflict = true;
    while (conflict) {
        currentSlot = findNextSlot(task.duration, currentSlot);
        const slotEnd = addMinutes(currentSlot, task.duration);

        conflict = entries.some(e => {
            const eStart = new Date(e.start_time);
            const eEnd = new Date(e.end_time);
            return (currentSlot < eEnd && slotEnd > eStart);
        });

        if (conflict) {
            currentSlot = addMinutes(currentSlot, 30); // Try 30 mins later
        }
    }

    const end_time = addMinutes(currentSlot, task.duration);
    entries.push({
        id: uuidv4(),
        user_id: userId,
        task_id: task.id,
        start_time: currentSlot.toISOString(),
        end_time: end_time.toISOString()
    });

    // Advance current slot for next task
    currentSlot = new Date(end_time);
  }

  return entries;
}
