import type { Task, Habit, Priority, Frequency } from './types';

let chronoModule: typeof import('chrono-node') | null = null;
let chronoLoadPromise: Promise<typeof import('chrono-node')> | null = null;

async function loadChrono() {
  if (chronoModule) return chronoModule;
  if (chronoLoadPromise) return chronoLoadPromise;
  chronoLoadPromise = import('chrono-node').then(mod => {
    chronoModule = mod;
    return mod;
  });
  return chronoLoadPromise;
}

export function isChronoLoaded(): boolean {
  return chronoModule !== null;
}

export async function parseNaturalLanguageInput(
  input: string,
  userId: string
): Promise<{ type: 'task' | 'habit'; data: Partial<Task> | Partial<Habit> } | null> {
  const chrono = await loadChrono();

  const lowerInput = input.toLowerCase();

  const isHabit = lowerInput.includes('every') || lowerInput.includes('daily') || lowerInput.includes('weekly');

  const parsedDate = chrono.parseDate(input);

  let title = input;
  const parsedResults = chrono.parse(input);
  if (parsedResults.length > 0) {
    const textToReplace = parsedResults[0].text;
    title = title.replace(textToReplace, '').trim();
  }

  title = title.replace(/\b(at|by|on)\s*$/i, '').trim();
  if (!title) title = input;

  if (isHabit) {
    let frequency: Frequency = 'daily';
    if (lowerInput.includes('weekly')) frequency = 'weekly';

    return {
      type: 'habit',
      data: {
        id: crypto.randomUUID(),
        user_id: userId,
        title: title.slice(0, 200).trim(),
        frequency,
        duration: 30,
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
        id: crypto.randomUUID(),
        user_id: userId,
        title: title.slice(0, 200).trim(),
        duration: 30,
        priority,
        deadline: parsedDate ? parsedDate.toISOString() : null,
        created_at: new Date().toISOString(),
        completed: false,
        date: new Date().toISOString().split('T')[0]
      }
    };
  }
}