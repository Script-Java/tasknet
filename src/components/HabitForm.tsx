import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Habit, Frequency } from '../lib/types';
import { upsertRecord } from '../lib/store';

export function HabitForm({ userId, onSaved }: { userId: string, onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [duration, setDuration] = useState('30');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const habit: Habit = {
      id: uuidv4(),
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
    <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-800 p-6 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 space-y-4">
      <h3 className="text-lg font-semibold">New Habit</h3>

      <div>
        <label className="block text-sm text-neutral-600 dark:text-neutral-400">Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="mt-1 w-full p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
          placeholder="e.g. Gym every day"
          required
        />
      </div>

      <div className="flex space-x-4">
        <div className="flex-1">
          <label className="block text-sm text-neutral-600 dark:text-neutral-400">Duration (min)</label>
          <input
            type="number"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            className="mt-1 w-full p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
            min="5"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-neutral-600 dark:text-neutral-400">Frequency</label>
          <select
            value={frequency}
            onChange={e => setFrequency(e.target.value as Frequency)}
            className="mt-1 w-full p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
      </div>

      <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition">
        Add Habit
      </button>
    </form>
  );
}
