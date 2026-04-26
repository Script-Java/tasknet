import { addMinutes, startOfDay, isAfter } from 'date-fns';

interface WorkerTask {
  id: string;
  duration: number;
  priority: 'low' | 'medium' | 'high';
  deadline?: string | null;
  completed?: boolean;
}

interface WorkerHabit {
  id: string;
  duration: number;
}

interface WorkerCalendarEntry {
  id: string;
  user_id: string;
  task_id?: string;
  habit_id?: string;
  start_time: string;
  end_time: string;
}

interface SchedulerPayload {
  tasks: WorkerTask[];
  habits: WorkerHabit[];
  userId: string;
  startDay: string;
}

function scheduleTasksAndHabits(
  tasks: WorkerTask[],
  habits: WorkerHabit[],
  userId: string,
  startDay: Date
): WorkerCalendarEntry[] {
  const entries: WorkerCalendarEntry[] = [];
  const parsedEntries: { start: number; end: number }[] = [];

  const workStartHour = 9;
  const workEndHour = 17;

  const pendingTasks = tasks.filter(t => !t.completed);

  const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };

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

  const findNextSlot = (durationMin: number, startFrom: Date) => {
    const slot = new Date(startFrom);
    if (slot.getHours() >= workEndHour) {
      slot.setDate(slot.getDate() + 1);
      slot.setHours(workStartHour, 0, 0, 0);
    } else if (slot.getHours() < workStartHour) {
      slot.setHours(workStartHour, 0, 0, 0);
    }

    const slotEnd = addMinutes(slot, durationMin);
    const endOfDayHour = new Date(slot);
    endOfDayHour.setHours(workEndHour, 0, 0, 0);

    if (isAfter(slotEnd, endOfDayHour)) {
      slot.setDate(slot.getDate() + 1);
      slot.setHours(workStartHour, 0, 0, 0);
    }

    return slot;
  };

  for (let i = 0; i < 7; i++) {
    const day = new Date(startDay);
    day.setDate(day.getDate() + i);

    for (const habit of habits) {
      let slot = new Date(day);
      slot.setHours(workStartHour, 0, 0, 0);

      let conflict = true;
      let attempts = 0;
      while (conflict && attempts < 500) {
        const slotEnd = addMinutes(slot, habit.duration);
        const slotMs = slot.getTime();
        const slotEndMs = slotEnd.getTime();

        conflict = parsedEntries.some(e => {
          return (slotMs < e.end && slotEndMs > e.start);
        });
        if (conflict) {
          slot = addMinutes(slot, 30);
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

      conflict = parsedEntries.some(e => {
        return (currentSlotMs < e.end && slotEndMs > e.start);
      });

      if (conflict) {
        currentSlot = addMinutes(currentSlot, 30);
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

    currentSlot = new Date(end_time);
  }

  return entries;
}

self.onmessage = (e: MessageEvent<SchedulerPayload>) => {
  const { tasks, habits, userId, startDay } = e.data;
  const result = scheduleTasksAndHabits(tasks, habits, userId, new Date(startDay));
  self.postMessage(result);
};