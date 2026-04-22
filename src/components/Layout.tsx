import React from 'react';
import { LogOut, Calendar, PlusCircle, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Layout({ children }: { children: React.ReactNode }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
      {/* Sidebar */}
      <aside className="w-16 md:w-64 bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 flex flex-col justify-between hidden sm:flex">
        <div className="p-4">
          <div className="flex items-center space-x-2 mb-8 hidden md:flex">
             <img src="/logo.png" alt="TaskNet Logo" className="w-8 h-8 object-contain" />
             <span className="text-xl font-bold tracking-wider">TASKNET</span>
          </div>
          <div className="flex justify-center md:hidden mb-8">
            <img src="/logo.png" alt="TaskNet Logo" className="w-8 h-8 object-contain" />
          </div>

          <nav className="space-y-4">
            <a href="#" className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 font-medium md:px-2">
              <Calendar className="w-5 h-5" />
              <span className="hidden md:inline">Calendar</span>
            </a>
            <a href="#" className="flex items-center space-x-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white md:px-2">
              <PlusCircle className="w-5 h-5" />
              <span className="hidden md:inline">Add Task</span>
            </a>
            <a href="#" className="flex items-center space-x-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white md:px-2">
              <Settings className="w-5 h-5" />
              <span className="hidden md:inline">Settings</span>
            </a>
          </nav>
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-neutral-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 md:px-2 w-full"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Nav */}
      <div className="sm:hidden fixed bottom-0 w-full bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 flex justify-around p-3 pb-safe">
          <a href="#" className="text-blue-600 dark:text-blue-400"><Calendar className="w-6 h-6" /></a>
          <a href="#" className="text-neutral-600 dark:text-neutral-400"><PlusCircle className="w-6 h-6" /></a>
          <button onClick={handleLogout} className="text-neutral-600 dark:text-neutral-400"><LogOut className="w-6 h-6" /></button>
      </div>
    </div>
  );
}
