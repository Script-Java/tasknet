import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Auth } from './components/Auth'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { CalendarPage } from './pages/CalendarPage'
import { SettingsPage } from './pages/SettingsPage'
import { supabase } from './lib/supabase'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <Toaster position="top-center" />
        <Auth />
      </>
    )
  }

  return (
    <Router>
      <Toaster position="top-center" toastOptions={{ className: 'dark:bg-neutral-800 dark:text-white' }} />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard userId={session.user.id} />} />
          <Route path="/calendar" element={<CalendarPage userId={session.user.id} />} />
          <Route path="/settings" element={<SettingsPage userId={session.user.id} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
