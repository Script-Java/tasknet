import * as chrono from 'chrono-node';
import type { Task, Habit, Priority, Frequency } from './types';
import { v4 as uuidv4 } from 'uuid';

export function parseNaturalLanguageInput(input: string, userId: string): { type: 'task' | 'habit', data: Partial<Task> | Partial<Habit> } | null {
  const lowerInput = input.toLowerCase();

  // Basic heuristic: if it contains "every", "daily", "weekly", it's a habit
  const isHabit = lowerInput.includes('every') || lowerInput.includes('daily') || lowerInput.includes('weekly');

  // Extract dates
  const parsedDate = chrono.parseDate(input);

  // Remove the date parts from the string for the title (rough heuristic)
  let title = input;
  const parsedResults = chrono.parse(input);
  if (parsedResults.length > 0) {
    const textToReplace = parsedResults[0].text;
    title = title.replace(textToReplace, '').trim();
  }

  // Remove stop words like 'at', 'by' if trailing
  title = title.replace(/\b(at|by|on)\s*$/i, '').trim();
  if (!title) title = input; // fallback

  if (isHabit) {
    let frequency: Frequency = 'daily';
    if (lowerInput.includes('weekly')) frequency = 'weekly';

    return {
      type: 'habit',
      data: {
        id: uuidv4(),
        user_id: userId,
        title,
        frequency,
        duration: 30, // default
        preferred_time: parsedDate ? parsedDate.toISOString() : null
      }
    };
  } else {
    let priority: Priority = 'medium';
    if (lowerInput.includes('urgent') || lowerInput.includes('asap') || lowerInput.includes('important')) {
      priority = 'high';
    }

    return {
      type: 'task',
      data: {
        id: uuidv4(),
        user_id: userId,
        title,
        duration: 30, // default
        priority,
        deadline: parsedDate ? parsedDate.toISOString() : null,
        created_at: new Date().toISOString(),
        completed: false
      }
    };
  }
}
