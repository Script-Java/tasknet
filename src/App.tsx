import { useEffect, useState } from 'react'
import { Auth } from './components/Auth'
import { Layout } from './components/Layout'
import { TaskForm } from './components/TaskForm'
import { NaturalInput } from './components/NaturalInput'
import { HabitForm } from './components/HabitForm'
import { CalendarView } from './components/CalendarView'
import { supabase } from './lib/supabase'
import { getAll, initDB } from './lib/store'
import { syncWithSupabase } from './lib/sync'
import { scheduleTasksAndHabits } from './lib/scheduler'
import type { Task, Habit, CalendarEntry } from './lib/types'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [tasks, setTasks] = useState<Task[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      if (session) loadDataAndSchedule(session.user.id)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadDataAndSchedule(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadDataAndSchedule = async (userId: string) => {
    await initDB();
    const localTasks = await getAll('tasks') as Task[];
    const localHabits = await getAll('habits') as Habit[];

    setTasks(localTasks);
    setHabits(localHabits);

    // Auto-schedule
    const scheduledEntries = scheduleTasksAndHabits(localTasks, localHabits, userId);
    setEntries(scheduledEntries);
  }

  const handleSync = async () => {
    if (!session) return;
    setIsSyncing(true);
    await syncWithSupabase();
    await loadDataAndSchedule(session.user.id);
    setIsSyncing(false);
  }

  const handleDataChanged = () => {
    if (session) loadDataAndSchedule(session.user.id);
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
  }

  if (!session) {
    return <Auth />
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-bold">Welcome back</h1>
            <p className="text-neutral-500 dark:text-neutral-400 mt-1">Let TaskNet handle your schedule.</p>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-300 dark:hover:bg-neutral-600 transition disabled:opacity-50"
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      <div className="mb-6"><NaturalInput userId={session.user.id} onSaved={handleDataChanged} /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <TaskForm userId={session.user.id} onSaved={handleDataChanged} />
        <HabitForm userId={session.user.id} onSaved={handleDataChanged} />
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6">Your Schedule</h2>
        <CalendarView entries={entries} tasks={tasks} habits={habits} />
      </div>
    </Layout>
  )
}

export default App
