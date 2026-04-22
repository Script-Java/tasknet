
import type { Task, Habit, CalendarEntry } from '../lib/types';
import { format, parseISO } from 'date-fns';

export function CalendarView({ entries, tasks, habits }: { entries: CalendarEntry[], tasks: Task[], habits: Habit[] }) {

  // Group by day
  const groupedEntries: { [key: string]: CalendarEntry[] } = {};

  // Sort entries chronologically
  const sortedEntries = [...entries].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  sortedEntries.forEach(entry => {
      const day = format(parseISO(entry.start_time), 'yyyy-MM-dd');
      if (!groupedEntries[day]) groupedEntries[day] = [];
      groupedEntries[day].push(entry);
  });

  if (Object.keys(groupedEntries).length === 0) {
      return (
          <div className="bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 text-center">
              <p className="text-neutral-500 dark:text-neutral-400">No scheduled tasks or habits yet. Add some to get started!</p>
          </div>
      );
  }

  return (
    <div className="space-y-8">
        {Object.keys(groupedEntries).sort().map(day => (
            <div key={day} className="space-y-4">
                <h2 className="text-xl font-bold border-b border-neutral-200 dark:border-neutral-700 pb-2">
                    {format(parseISO(day), 'EEEE, MMMM do')}
                </h2>
                <div className="space-y-3">
                    {groupedEntries[day].map(entry => {
                        const task = entry.task_id ? tasks.find(t => t.id === entry.task_id) : null;
                        const habit = entry.habit_id ? habits.find(h => h.id === entry.habit_id) : null;

                        const item = task || habit;
                        if (!item) return null;

                        const isHabit = !!habit;

                        return (
                            <div key={entry.id} className={`p-4 rounded-xl shadow-sm border flex flex-col md:flex-row md:items-center justify-between ${isHabit ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800' : 'bg-white dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700'}`}>
                                <div>
                                    <h4 className="font-semibold text-lg flex items-center space-x-2">
                                        <span>{item.title}</span>
                                        {isHabit && <span className="text-xs bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded-full">Habit</span>}
                                        {task && <span className={`text-xs px-2 py-0.5 rounded-full ${(task as Task).priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' : (task as Task).priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'}`}>{(task as Task).priority}</span>}
                                    </h4>
                                    <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                                        {format(parseISO(entry.start_time), 'h:mm a')} - {format(parseISO(entry.end_time), 'h:mm a')}
                                    </div>
                                </div>
                                <div className="mt-2 md:mt-0 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                                    {item.duration} min
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        ))}
    </div>
  );
}
