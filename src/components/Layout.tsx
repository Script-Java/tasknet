import { NavLink } from 'react-router-dom';
import { LogOut, Calendar, Settings, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Layout({ children }: { children: React.ReactNode }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-3 md:px-3 py-2 rounded-xl transition-all duration-200 ${
      isActive
        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold'
        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white font-medium'
    }`;

  const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 ${
      isActive
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
    }`;

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/30">
      {/* Sidebar */}
      <aside className="w-20 md:w-64 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-xl border-r border-neutral-200/50 dark:border-neutral-700/50 flex-col justify-between hidden sm:flex shadow-sm z-10">
        <div className="p-4 md:p-6">
          <div className="flex justify-center mb-10 cursor-default">
             <img src="/logo.png" alt="TaskNet Logo" className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-md" />
          </div>

          <nav className="space-y-2">
            <NavLink to="/" className={navItemClass}>
              <Home className="w-5 h-5" />
              <span className="hidden md:inline">Dashboard</span>
            </NavLink>
            <NavLink to="/calendar" className={navItemClass}>
              <Calendar className="w-5 h-5" />
              <span className="hidden md:inline">Calendar</span>
            </NavLink>
            <NavLink to="/settings" className={navItemClass}>
              <Settings className="w-5 h-5" />
              <span className="hidden md:inline">Settings</span>
            </NavLink>
          </nav>
        </div>

        <div className="p-4 md:p-6 border-t border-neutral-200/50 dark:border-neutral-700/50">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 text-neutral-500 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 md:px-3 py-2 rounded-xl transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden md:inline font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8 lg:p-12 pb-24 sm:pb-8 relative">
        {/* Subtle background decoration */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-900/10 dark:to-transparent pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto h-full">
          {children}
        </div>
      </main>

      {/* Mobile Nav */}
      <div className="sm:hidden fixed bottom-0 w-full bg-white/90 dark:bg-neutral-800/90 backdrop-blur-xl border-t border-neutral-200/50 dark:border-neutral-700/50 flex justify-around h-16 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-50">
          <NavLink to="/" className={mobileNavClass}>
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-medium">Home</span>
          </NavLink>
          <NavLink to="/calendar" className={mobileNavClass}>
            <Calendar className="w-6 h-6" />
            <span className="text-[10px] font-medium">Calendar</span>
          </NavLink>
          <NavLink to="/settings" className={mobileNavClass}>
            <Settings className="w-6 h-6" />
            <span className="text-[10px] font-medium">Settings</span>
          </NavLink>
      </div>
    </div>
  );
}
