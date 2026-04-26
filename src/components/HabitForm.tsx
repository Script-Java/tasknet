import React, { useState } from 'react';

import type { Habit, Frequency } from '../lib/types';
import { upsertRecord } from '../lib/store';
import { Plus } from 'lucide-react';

export function HabitForm({ userId, onSaved }: { userId: string, onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [duration, setDuration] = useState('30');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const habit: Habit = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      frequency,
      duration: parseInt(duration),
    };

    await upsertRecord('habits', habit);
    setTitle('');
    setFrequency('daily');
    setDuration('30');
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="galaxy-card p-4 md:p-6 space-y-5">
      <h3 className="text-lg font-bold text-[#EEEEF8]">New Habit</h3>

      <div>
        <label className="block text-sm font-medium text-[#8E89B3] mb-1.5">Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="galaxy-input"
          placeholder="e.g. Gym every day"
          required
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:space-x-4 gap-4 sm:gap-0">
        <div className="flex-1">
          <label className="block text-sm font-medium text-[#8E89B3] mb-1.5">Duration (min)</label>
          <input
            type="number"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            className="galaxy-input"
            min="5"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-[#8E89B3] mb-1.5">Frequency</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFrequency('daily')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all border ${
                frequency === 'daily'
                  ? 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.3)] text-[#A78BFA]'
                  : 'bg-[rgba(13,11,30,0.4)] border-[#2A2545] text-[#5C5780] hover:text-[#8E89B3]'
              }`}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => setFrequency('weekly')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all border ${
                frequency === 'weekly'
                  ? 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.3)] text-[#A78BFA]'
                  : 'bg-[rgba(13,11,30,0.4)] border-[#2A2545] text-[#5C5780] hover:text-[#8E89B3]'
              }`}
            >
              Weekly
            </button>
          </div>
        </div>
      </div>

      <button type="submit" className="galaxy-btn w-full flex items-center justify-center space-x-2">
        <Plus className="w-5 h-5" />
        <span>Add Habit</span>
      </button>
    </form>
  );
}