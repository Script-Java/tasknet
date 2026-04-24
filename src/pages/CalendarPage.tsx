import { useEffect, useState, useMemo } from 'react';
import { getAll, initDB } from '../lib/store';
import { scheduleTasksAndHabits } from '../lib/scheduler';
import type { Task, Habit, CalendarEntry } from '../lib/types';
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';

export function CalendarPage({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    const loadData = async () => {
      await initDB();
      const localTasks = await getAll('tasks') as Task[];
      const localHabits = await getAll('habits') as Habit[];

      setTasks(localTasks);
      setHabits(localHabits);

      const scheduledEntries = scheduleTasksAndHabits(localTasks, localHabits, userId);
      setEntries(scheduledEntries);
    };
    loadData();
  }, [userId]);

  // Generate week view
  const startDate = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]); // Start on Monday
  const weekDays = useMemo(() => [...Array(7)].map((_, i) => addDays(startDate, i)), [startDate]);

  // Filter entries for selected day
  const selectedDayEntries = useMemo(() => {
    return entries
      .filter(e => isSameDay(parseISO(e.start_time), selectedDate))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [entries, selectedDate]);

  // Group entries by hour to prevent O(N*13) filtering during render
  const entriesByHour = useMemo(() => {
    const map = new Map<number, CalendarEntry[]>();
    selectedDayEntries.forEach(e => {
      const hour = new Date(e.start_time).getHours();
      if (!map.has(hour)) {
        map.set(hour, []);
      }
      map.get(hour)!.push(e);
    });
    return map;
  }, [selectedDayEntries]);

  // Generate hours for the day view (8 AM to 8 PM)
  const hours = useMemo(() => Array.from({ length: 13 }, (_, i) => i + 8), []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      <div>
          <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white">Calendar</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-lg">Your auto-generated schedule.</p>
      </div>

      <div className="flex-1 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md rounded-[2rem] shadow-sm border border-neutral-100 dark:border-neutral-700/50 flex flex-col overflow-hidden">

        {/* Weekly Header */}
        <div className="border-b border-neutral-200 dark:border-neutral-700 bg-white/40 dark:bg-neutral-900/40 p-4">
            <div className="flex justify-between items-center max-w-3xl mx-auto">
                {weekDays.map(day => {
                    const isSelected = isSameDay(day, selectedDate);
                    return (
                        <button
                            key={day.toISOString()}
                            onClick={() => setSelectedDate(day)}
                            className={`flex flex-col items-center p-3 rounded-2xl min-w-[3rem] transition-all ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'}`}
                        >
                            <span className="text-xs font-semibold uppercase">{format(day, 'EEE')}</span>
                            <span className="text-xl font-bold mt-1">{format(day, 'd')}</span>
                        </button>
                    )
                })}
            </div>
        </div>

        {/* Daily Details View */}
        <div className="flex-1 overflow-y-auto p-6 relative">
             <div className="max-w-3xl mx-auto relative">
                 {/* Timeline Background */}
                 <div className="absolute left-16 top-0 bottom-0 w-px bg-neutral-200 dark:bg-neutral-700"></div>

                 {hours.map(hour => {
                     // Check if any entries fall in this hour block strictly for visual grouping (simplified)
                     const hourEntries = entriesByHour.get(hour) || [];

                     return (
                         <div key={hour} className="relative flex min-h-[5rem] group">
                             {/* Time Label */}
                             <div className="w-16 pr-4 text-right flex-shrink-0">
                                 <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500 -mt-2 inline-block">
                                     {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                                 </span>
                             </div>

                             {/* Horizontal Line */}
                             <div className="absolute left-16 right-0 border-t border-neutral-100 dark:border-neutral-800/50 -mt-px group-hover:border-neutral-200 dark:group-hover:border-neutral-700 transition-colors"></div>

                             {/* Render Entries */}
                             <div className="flex-1 pl-6 pb-2 pt-1">
                                 {hourEntries.map(entry => {
                                     const task = entry.task_id ? tasks.find(t => t.id === entry.task_id) : null;
                                     const habit = entry.habit_id ? habits.find(h => h.id === entry.habit_id) : null;
                                     const item = task || habit;
                                     if (!item) return null;

                                     const isHabit = !!habit;
                                     const duration = item.duration;

                                     // Extremely simplified height calculation (1 min = 1px approximately)
                                     const heightClass = duration > 45 ? 'min-h-[5rem]' : duration > 20 ? 'min-h-[3rem]' : 'min-h-[2rem]';

                                     return (
                                         <div key={entry.id} className={`mb-2 p-3 rounded-xl border relative shadow-sm ${heightClass} ${isHabit ? 'bg-indigo-50/80 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}`}>
                                            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b opacity-50 block" style={{ backgroundImage: isHabit ? 'linear-gradient(to bottom, #6366f1, #a855f7)' : 'linear-gradient(to bottom, #3b82f6, #06b6d4)'}}></div>
                                            <div className="flex justify-between items-start ml-2">
                                                <div>
                                                    <h4 className={`font-bold ${isHabit ? 'text-indigo-900 dark:text-indigo-100' : 'text-blue-900 dark:text-blue-100'}`}>{item.title}</h4>
                                                    <div className="text-xs font-medium mt-1 opacity-70">
                                                        {format(parseISO(entry.start_time), 'h:mm a')} - {format(parseISO(entry.end_time), 'h:mm a')}
                                                    </div>
                                                </div>
                                                {task && (
                                                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md ${(task as Task).priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : (task as Task).priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'}`}>
                                                        {(task as Task).priority}
                                                    </span>
                                                )}
                                            </div>
                                         </div>
                                     );
                                 })}
                             </div>
                         </div>
                     );
                 })}
             </div>

             {selectedDayEntries.length === 0 && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md px-6 py-4 rounded-2xl text-center border border-neutral-100 dark:border-neutral-800 shadow-sm">
                        <p className="text-neutral-500 font-medium">No tasks scheduled for this day.</p>
                     </div>
                 </div>
             )}
        </div>
      </div>
    </div>
  );
}
