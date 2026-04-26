import { NavLink } from 'react-router-dom';
import { LogOut, Calendar, Home, Repeat, CheckSquare, User, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Layout({ children }: { children: React.ReactNode }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-3 md:px-3 py-2.5 rounded-xl transition-all duration-200 ${
      isActive
        ? 'bg-[rgba(139,92,246,0.08)] text-[#A78BFA] font-semibold border-l-2 border-[#A78BFA]'
        : 'text-[#5C5780] hover:text-[#A78BFA] hover:bg-[rgba(139,92,246,0.04)] font-medium'
    }`;

  const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-all duration-200 active:scale-95 ${
      isActive
        ? 'text-[#A78BFA]'
        : 'text-[#5C5780] hover:text-[#A78BFA]'
    }`;

  return (
    <div className="flex h-screen text-neutral-100 font-sans">
      {/* Sidebar */}
      <aside
        className="w-20 md:w-64 flex-col justify-between hidden sm:flex z-10"
        style={{
          background: 'rgba(13, 11, 30, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(42, 37, 69, 0.5)',
        }}
      >
        <div className="p-4 md:p-6">
          <div className="flex justify-center mb-10 cursor-default">
            <img src="/logo.png" alt="Fides" className="w-10 h-10 md:w-12 md:h-12 object-contain" />
          </div>

          <nav className="space-y-2">
            <NavLink to="/" className={navItemClass} end>
              <Home className="w-5 h-5" />
              <span className="hidden md:inline">Dashboard</span>
            </NavLink>
            <NavLink to="/calendar" className={navItemClass}>
              <Calendar className="w-5 h-5" />
              <span className="hidden md:inline">Calendar</span>
            </NavLink>
            <NavLink to="/tasks" className={navItemClass}>
              <CheckSquare className="w-5 h-5" />
              <span className="hidden md:inline">Tasks</span>
            </NavLink>
            <NavLink to="/habits" className={navItemClass}>
              <Repeat className="w-5 h-5" />
              <span className="hidden md:inline">Habits</span>
            </NavLink>
            <NavLink to="/groups" className={navItemClass}>
              <Users className="w-5 h-5" />
              <span className="hidden md:inline">Groups</span>
            </NavLink>
            <NavLink to="/profile" className={navItemClass}>
              <User className="w-5 h-5" />
              <span className="hidden md:inline">Profile</span>
            </NavLink>
          </nav>
        </div>

        <div className="p-4 md:p-6" style={{ borderTop: '1px solid rgba(42, 37, 69, 0.5)' }}>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 text-[#5C5780] hover:text-[#EF5350] md:px-3 py-2.5 rounded-xl transition-colors w-full font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8 lg:p-12 pb-24 sm:pb-8 relative">
        <div className="max-w-6xl mx-auto h-full">
          {children}
        </div>
      </main>

      {/* Mobile Nav */}
      <div
        className="sm:hidden fixed bottom-0 w-full flex justify-around h-16 pb-safe z-50"
        style={{
          background: 'rgba(6, 4, 15, 0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(42, 37, 69, 0.5)',
        }}
      >
        <NavLink to="/" className={mobileNavClass} end>
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-tight">Home</span>
        </NavLink>
        <NavLink to="/calendar" className={mobileNavClass}>
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-tight">Calendar</span>
        </NavLink>
        <NavLink to="/tasks" className={mobileNavClass}>
          <CheckSquare className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-tight">Tasks</span>
        </NavLink>
        <NavLink to="/habits" className={mobileNavClass}>
          <Repeat className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-tight">Habits</span>
        </NavLink>
        <NavLink to="/groups" className={mobileNavClass}>
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-tight">Groups</span>
        </NavLink>
        <NavLink to="/profile" className={mobileNavClass}>
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-tight">Profile</span>
        </NavLink>
      </div>
    </div>
  );
}