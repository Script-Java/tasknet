export function SettingsPage({ userId }: { userId: string }) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
      <div>
          <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white">Settings</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-lg">Manage your TaskNet preferences.</p>
      </div>

      <div className="bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md p-8 rounded-[2rem] shadow-sm border border-neutral-100 dark:border-neutral-700/50 space-y-6">
        <div>
          <h3 className="text-xl font-bold mb-4">Account Profile</h3>
          <p className="text-neutral-600 dark:text-neutral-300">User ID: <span className="font-mono text-sm bg-neutral-100 dark:bg-neutral-900 px-2 py-1 rounded">{userId}</span></p>
        </div>

        <hr className="border-neutral-200 dark:border-neutral-700" />

        <div>
          <h3 className="text-xl font-bold mb-4">Work Hours</h3>
          <p className="text-neutral-500 dark:text-neutral-400 mb-4">TaskNet uses these hours to automatically schedule your tasks.</p>
          <div className="flex items-center space-x-4">
             <div className="space-y-1">
                <label className="text-sm font-medium">Start Time</label>
                <input type="time" defaultValue="09:00" className="block w-full p-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500" />
             </div>
             <div className="space-y-1">
                <label className="text-sm font-medium">End Time</label>
                <input type="time" defaultValue="17:00" className="block w-full p-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-blue-500" />
             </div>
          </div>
          <button className="mt-4 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl hover:opacity-90 transition">
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
