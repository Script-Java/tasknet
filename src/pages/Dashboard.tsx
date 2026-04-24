import { useEffect, useState } from 'react';
import { NaturalInput } from '../components/NaturalInput';
import { TaskForm } from '../components/TaskForm';
import { HabitForm } from '../components/HabitForm';
import { getAll, initDB, deleteRecord, upsertRecord } from '../lib/store';
import { syncWithSupabase } from '../lib/sync';
import type { Task, Habit } from '../lib/types';
import { Circle, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export function Dashboard({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadData = async () => {
    await initDB();
    const localTasks = await getAll('tasks') as Task[];
    const localHabits = await getAll('habits') as Habit[];

    setTasks(localTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setHabits(localHabits);
  };

  useEffect(() => {
    let mounted = true;
    const fetchInitialData = async () => {
      await initDB();
      const localTasks = await getAll('tasks') as Task[];
      const localHabits = await getAll('habits') as Habit[];

      if (mounted) {
        setTasks(localTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        setHabits(localHabits);
      }
    };
    fetchInitialData();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncWithSupabase();
      await loadData();
      toast.success('Synced with cloud');
    } catch {
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleTaskCompletion = async (task: Task) => {
    const updatedTask = { ...task, completed: !task.completed };
    await upsertRecord('tasks', updatedTask);
    await loadData();
    if (updatedTask.completed) {
      toast.success('Task completed!', { icon: '🎉' });
    }
  };

  const handleDeleteTask = async (id: string) => {
    await deleteRecord('tasks', id);
    await loadData();
    toast.success('Task deleted');
  };

  const handleDeleteHabit = async (id: string) => {
    await deleteRecord('habits', id);
    await loadData();
    toast.success('Habit deleted');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
            <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white">Dashboard</h1>
            <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-lg">Let TaskNet handle your execution.</p>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center space-x-2 px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </div>

      <div className="max-w-2xl">
        <NaturalInput userId={userId} onSaved={loadData} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Left Column - Forms */}
        <div className="space-y-8">
          <TaskForm userId={userId} onSaved={loadData} />
          <HabitForm userId={userId} onSaved={loadData} />
        </div>

        {/* Right Column - Lists */}
        <div className="space-y-8">
          {/* Active Tasks */}
          <div className="bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-700/50">
            <h3 className="text-xl font-bold mb-4 flex items-center justify-between">
              Active Tasks
              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 py-0.5 px-2.5 rounded-full text-sm font-medium">
                {tasks.filter(t => !t.completed).length}
              </span>
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {tasks.filter(t => !t.completed).map(task => (
                <div key={task.id} className="group flex items-center justify-between p-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                  <div className="flex items-center space-x-4 overflow-hidden">
                    <button onClick={() => toggleTaskCompletion(task)} className="text-neutral-300 dark:text-neutral-600 hover:text-green-500 transition-colors flex-shrink-0">
                      <Circle className="w-6 h-6" />
                    </button>
                    <div className="truncate">
                      <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{task.title}</p>
                      <p className="text-xs text-neutral-500 mt-0.5 flex items-center space-x-2">
                        <span>{task.duration}m</span>
                        <span className="w-1 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full"></span>
                        <span className={`capitalize ${task.priority === 'high' ? 'text-red-500' : task.priority === 'medium' ? 'text-yellow-500' : 'text-green-500'}`}>{task.priority} Priority</span>
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-2 text-neutral-400 hover:text-red-500 transition-all flex-shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {tasks.filter(t => !t.completed).length === 0 && (
                <p className="text-neutral-500 dark:text-neutral-400 text-center py-8">No active tasks. You're all caught up!</p>
              )}
            </div>
          </div>

          {/* Habits */}
          <div className="bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-700/50">
            <h3 className="text-xl font-bold mb-4 flex items-center justify-between">
              Habits
              <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 py-0.5 px-2.5 rounded-full text-sm font-medium">
                {habits.length}
              </span>
            </h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {habits.map(habit => (
                <div key={habit.id} className="group flex items-center justify-between p-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                  <div className="overflow-hidden">
                    <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{habit.title}</p>
                    <p className="text-xs text-neutral-500 mt-0.5 capitalize">{habit.frequency} • {habit.duration}m</p>
                  </div>
                  <button onClick={() => handleDeleteHabit(habit.id)} className="opacity-0 group-hover:opacity-100 p-2 text-neutral-400 hover:text-red-500 transition-all flex-shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {habits.length === 0 && (
                <p className="text-neutral-500 dark:text-neutral-400 text-center py-8">No habits set up yet.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
