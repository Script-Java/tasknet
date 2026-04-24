import { scheduleTasksAndHabits } from './src/lib/scheduler';
import type { Task, Habit } from './src/lib/types';
import { v4 as uuidv4 } from 'uuid';

const tasks: Task[] = [];
for (let i = 0; i < 500; i++) {
    tasks.push({
        id: uuidv4(),
        user_id: 'user1',
        title: `Task ${i}`,
        duration: 30, // 30 minutes
        priority: 'medium',
        created_at: new Date().toISOString(),
        completed: false
    });
}

const habits: Habit[] = [];
for (let i = 0; i < 20; i++) {
    habits.push({
        id: uuidv4(),
        user_id: 'user1',
        title: `Habit ${i}`,
        frequency: 'daily',
        duration: 15
    });
}

const start = performance.now();
scheduleTasksAndHabits(tasks, habits, 'user1', new Date());
const end = performance.now();

console.log(`Scheduling took ${end - start} ms`);
