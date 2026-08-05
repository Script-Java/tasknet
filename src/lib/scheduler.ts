import type { Task, Habit, CalendarEntry } from './types';

import { addMinutes, startOfDay, isAfter } from 'date-fns';

export function scheduleTasksAndHabits(
  tasks: Task[],
  habits: Habit[],
  userId: string,
  startDay: Date = new Date()
): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  const parsedEntries: { start: number; end: number }[] = [];

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

        // Find non-overlapping slot
        let conflict = true;
        let attempts = 0;
        while (conflict && attempts < 500) {
            const slotEnd = addMinutes(slot, habit.duration);
            const slotMs = slot.getTime();
            const slotEndMs = slotEnd.getTime();

            const conflictingEntry = parsedEntries.find(e => {
                return (slotMs < e.end && slotEndMs > e.start);
            });
            if (conflictingEntry) {
                slot = new Date(conflictingEntry.end);
            } else {
                conflict = false;
            }
            attempts++;
        }
        if (conflict) continue;

        const end_time = addMinutes(slot, habit.duration);
        entries.push({
            id: crypto.randomUUID(),
            user_id: userId,
            habit_id: habit.id,
            start_time: slot.toISOString(),
            end_time: end_time.toISOString()
        });
        parsedEntries.push({
            start: slot.getTime(),
            end: end_time.getTime()
        });
    }
  }

  // Schedule tasks
  currentSlot = new Date(startDay);
  if (currentSlot.getHours() < workStartHour) currentSlot.setHours(workStartHour, 0, 0, 0);

  for (const task of pendingTasks) {
    let conflict = true;
    let attempts = 0;
    while (conflict && attempts < 500) {
        currentSlot = findNextSlot(task.duration, currentSlot);
        const slotEnd = addMinutes(currentSlot, task.duration);
        const currentSlotMs = currentSlot.getTime();
        const slotEndMs = slotEnd.getTime();

        const conflictingEntry = parsedEntries.find(e => {
            return (currentSlotMs < e.end && slotEndMs > e.start);
        });

        if (conflictingEntry) {
            currentSlot = new Date(conflictingEntry.end);
        } else {
            conflict = false;
        }
        attempts++;
    }
    if (conflict) continue;

    const end_time = addMinutes(currentSlot, task.duration);
    entries.push({
        id: crypto.randomUUID(),
        user_id: userId,
        task_id: task.id,
        start_time: currentSlot.toISOString(),
        end_time: end_time.toISOString()
    });
    parsedEntries.push({
        start: currentSlot.getTime(),
        end: end_time.getTime()
    });

    // Advance current slot for next task
    currentSlot = new Date(end_time);
  }

  return entries;
}
