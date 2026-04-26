import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import type { Session } from '@supabase/supabase-js'
import { Auth } from './components/Auth'
import { Layout } from './components/Layout'
import { supabase } from './lib/supabase'
import { social } from './lib/social'
import { BadgeProvider } from './contexts/BadgeContext'
import { useAutoSync } from './hooks/useAutoSync'
import { Dashboard } from './pages/Dashboard'
import { TasksPage } from './pages/TasksPage'
import { CalendarPage } from './pages/CalendarPage'
import { HabitsPage } from './pages/HabitsPage'
import { GroupsPage } from './pages/GroupsPage'
import { ProfilePage } from './pages/ProfilePage'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useAutoSync()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        social.ensureProfile().catch(() => {})
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (_event === 'SIGNED_IN' && session?.user) {
        social.ensureProfile().catch(() => {})
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'linear-gradient(165deg, #0D0B1E 0%, #060618 40%, #030208 100%)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B5CF6]"></div>
      </div>
    )
  }

  return (
    <Router>
      <Toaster position="top-center" toastOptions={{ className: 'text-[#EEEEF8]', style: { background: 'rgba(21,18,42,0.95)', border: '1px solid #2A2545', backdropFilter: 'blur(12px)' } }} />
      <BadgeProvider>
        {!session ? (
          <Auth />
        ) : (
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard userId={session.user.id} />} />
              <Route path="/tasks" element={<TasksPage userId={session.user.id} />} />
              <Route path="/calendar" element={<CalendarPage userId={session.user.id} />} />
              <Route path="/habits" element={<HabitsPage userId={session.user.id} />} />
              <Route path="/groups" element={<GroupsPage userId={session.user.id} />} />
              <Route path="/profile" element={<ProfilePage userId={session.user.id} />} />
              <Route path="/profile/:id" element={<ProfilePage userId={session.user.id} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        )}
      </BadgeProvider>
    </Router>
  )
}

export default App
