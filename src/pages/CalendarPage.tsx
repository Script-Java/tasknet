import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { getAll, initDB } from '../lib/store';
import type { Task, Habit, CalendarEntry } from '../lib/types';
import { format, parseISO, startOfWeek, addDays, isSameDay, isBefore, isToday } from 'date-fns';
import { Plus, CalendarClock } from 'lucide-react';

export function CalendarPage({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isScheduling, setIsScheduling] = useState(false);
  const naturalInputRef = useRef<HTMLInputElement | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const runScheduler = useCallback(async () => {
    setIsScheduling(true);
    await initDB();
    const localTasks = await getAll('tasks') as Task[];
    const localHabits = await getAll('habits') as Habit[];

    setTasks(localTasks);
    setHabits(localHabits);

    if (workerRef.current) {
      workerRef.current.terminate();
    }

    const worker = new Worker(
      new URL('../workers/scheduler.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<CalendarEntry[]>) => {
      setEntries(e.data);
      setIsScheduling(false);
    };

    worker.onerror = () => {
      setIsScheduling(false);
    };

    const serializableTasks = localTasks.map(t => ({
      id: t.id,
      duration: t.duration,
      priority: t.priority,
      deadline: t.deadline,
      completed: t.completed,
    }));

    const serializableHabits = localHabits.map(h => ({
      id: h.id,
      duration: h.duration,
    }));

    worker.postMessage({
      tasks: serializableTasks,
      habits: serializableHabits,
      userId,
      startDay: new Date().toISOString(),
    });
  }, [userId]);

  useEffect(() => {
    runScheduler();
  }, [runScheduler]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const startDate = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);
  const weekDays = useMemo(() => [...Array(7)].map((_, i) => addDays(startDate, i)), [startDate]);

  const selectedDayEntries = useMemo(() => {
    return entries
      .filter(e => isSameDay(parseISO(e.start_time), selectedDate))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [entries, selectedDate]);

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

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const habitMap = useMemo(() => new Map(habits.map(h => [h.id, h])), [habits]);

  const hours = useMemo(() => Array.from({ length: 13 }, (_, i) => i + 8), []);

  const showNowIndicator = isToday(selectedDate);
  const nowTop = useMemo(() => {
    if (!showNowIndicator) return 0;
    const hour = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    if (hour < 8 || hour > 20) return 0;
    return (hour - 8 + minutes / 60) * 80;
  }, [currentTime, showNowIndicator]);

  const handleAddTask = useCallback(() => {
    if (naturalInputRef.current) {
      naturalInputRef.current.focus();
    } else {
      const input = document.querySelector<HTMLInputElement>('input[aria-label="Task or habit description"]');
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, []);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#EEEEF8]">Calendar</h1>
          <p className="text-[#8E89B3] mt-1 md:mt-2 text-base md:text-lg">Your auto-generated schedule.</p>
      </div>

      <div className="galaxy-card flex-1 rounded-[1.5rem] md:rounded-[2rem] flex flex-col overflow-hidden">

        {/* Weekly Header */}
        <div className="border-b border-[#2A2545] bg-[rgba(21,18,42,0.5)] px-1.5 py-2 md:p-4">
            <div className="flex justify-between items-center max-w-3xl mx-auto">
                {weekDays.map(day => {
                    const isSelected = isSameDay(day, selectedDate);
                    return (
                        <button
                            key={day.toISOString()}
                            onClick={() => setSelectedDate(day)}
                            className={`flex flex-col items-center p-1.5 md:p-3 rounded-lg md:rounded-2xl min-w-0 flex-1 transition-all ${isSelected ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/30 md:scale-110' : 'hover:bg-[rgba(139,92,246,0.1)] text-[#8E89B3]'}`}
                        >
                            <span className="text-[10px] md:text-xs font-semibold uppercase">{format(day, 'EEE')}</span>
                            <span className="text-base md:text-xl font-bold mt-0.5 md:mt-1">{format(day, 'd')}</span>
                        </button>
                    )
                })}
            </div>
        </div>

        {/* Daily Details View */}
<div className="flex-1 overflow-y-auto p-2 md:p-6 relative">
             <div className="max-w-3xl mx-auto relative">
                  {/* Timeline Background */}
                  <div className="absolute left-10 md:left-16 top-0 bottom-0 w-px bg-[#2A2545]"></div>

                 {/* Now Indicator */}
                 {showNowIndicator && nowTop > 0 && (
                   <div
                     className="absolute left-10 md:left-16 right-0 z-10 flex items-center pointer-events-none"
                     style={{ top: nowTop }}
                   >
                     <div className="w-2 h-2 rounded-full bg-[#EF5350] -ml-[3px]" />
                     <div className="flex-1 h-px bg-[#EF5350]/60" />
                   </div>
                 )}

                 {hours.map(hour => {
                     const hourEntries = entriesByHour.get(hour) || [];

                     return (
                         <div key={hour} className="relative flex min-h-[4rem] md:min-h-[5rem] group">
                             {/* Time Label */}
                             <div className="w-10 md:w-16 pr-1 md:pr-4 text-right flex-shrink-0">
                                 <span className="text-[10px] md:text-xs font-medium text-[#5C5780] -mt-2 inline-block">
                                     {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                                 </span>
                             </div>

                             {/* Horizontal Line */}
<div className="absolute left-10 md:left-16 right-0 border-t border-[#2A2545]/60 -mt-px group-hover:border-[#8B5CF6]/30 transition-colors"></div>

                              {/* Render Entries */}
                              <div className="flex-1 pl-3 md:pl-6 pb-2 pt-1">
                                  {hourEntries.map(entry => {
                                      const task = entry.task_id ? taskMap.get(entry.task_id) : null;
                                      const habit = entry.habit_id ? habitMap.get(entry.habit_id) : null;
                                      const item = task || habit;
                                      if (!item) return null;

                                      const isHabit = !!habit;
                                      const duration = item.duration;
                                      const isOverdue = task && !task.completed && task.deadline && isBefore(parseISO(task.deadline), startOfDay(selectedDate));

                                      const heightClass = duration > 45 ? 'min-h-[4rem] md:min-h-[5rem]' : duration > 20 ? 'min-h-[2.5rem] md:min-h-[3rem]' : 'min-h-[2rem]';

                                      return (
                                          <div key={entry.id} className={`mb-2 p-2 md:p-3 rounded-xl border relative shadow-sm ${heightClass} ${isOverdue ? 'bg-[rgba(239,68,68,0.1)] border-red-500/40' : isHabit ? 'bg-[rgba(139,92,246,0.08)] border-[#8B5CF6]/30' : 'bg-[rgba(59,130,246,0.08)] border-blue-500/30'}`}>
                                             <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b opacity-60 block" style={{ backgroundImage: isOverdue ? 'linear-gradient(to bottom, #ef4444, #dc2626)' : isHabit ? 'linear-gradient(to bottom, #8B5CF6, #A78BFA)' : 'linear-gradient(to bottom, #3b82f6, #06b6d4)'}}></div>
                                             <div className="flex justify-between items-start ml-2">
                                                 <div className="min-w-0">
                                                     <h4 className={`font-bold text-sm md:text-base truncate ${isOverdue ? 'text-red-300' : isHabit ? 'text-[#A78BFA]' : 'text-blue-300'}`}>{item.title}</h4>
                                                     <div className="text-[10px] md:text-xs font-medium mt-1 text-[#8E89B3]">
                                                         {format(parseISO(entry.start_time), 'h:mm a')} - {format(parseISO(entry.end_time), 'h:mm a')}
                                                         {isOverdue && <span className="ml-2 text-red-400 font-bold">OVERDUE</span>}
                                                     </div>
                                                 </div>
                                                 {task && !isOverdue && (
                                                     <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md flex-shrink-0 ml-2 ${(task as Task).priority === 'high' ? 'bg-[rgba(239,68,68,0.2)] text-red-300' : (task as Task).priority === 'medium' ? 'bg-[rgba(234,179,8,0.15)] text-yellow-300' : 'bg-[rgba(34,197,94,0.15)] text-green-300'}`}>
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

             {selectedDayEntries.length === 0 && !isScheduling && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                     <div className="galaxy-card px-6 py-5 rounded-2xl text-center space-y-4">
                        <div className="space-y-1">
                          <p className="text-[#EEEEF8] font-semibold text-base">No tasks scheduled for this day</p>
                          <p className="text-[#8E89B3] text-sm">Start organizing your day with a task or let the scheduler build your plan.</p>
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={handleAddTask}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-sm font-semibold rounded-xl shadow-md shadow-[#8B5CF6]/25 transition-all"
                          >
                            <Plus className="w-4 h-4" />
                            Add a Task
                          </button>
                          <button
                            onClick={runScheduler}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[rgba(139,92,246,0.12)] hover:bg-[rgba(139,92,246,0.2)] text-[#A78BFA] text-sm font-semibold rounded-xl border border-[#8B5CF6]/30 transition-all"
                          >
                            <CalendarClock className="w-4 h-4" />
                            Generate Schedule
                          </button>
                        </div>
                     </div>
                 </div>
             )}

             {isScheduling && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="galaxy-card px-6 py-4 rounded-2xl text-center">
                        <div className="flex items-center gap-2 text-[#8E89B3]">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#8B5CF6]"></div>
                          <span className="text-sm font-medium">Generating schedule...</span>
                        </div>
                     </div>
                 </div>
             )}
        </div>
      </div>
    </div>
  );
}