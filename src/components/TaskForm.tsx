import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Task, Priority } from '../lib/types';
import { upsertRecord } from '../lib/store';
import toast from 'react-hot-toast';

export function TaskForm({ userId, onSaved }: { userId: string, onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('30');
  const [priority, setPriority] = useState<Priority>('medium');
  const [deadline, setDeadline] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const parsedDuration = parseInt(duration, 10);
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      toast.error('Duration must be a positive integer');
      return;
    }

    const task: Task = {
      id: uuidv4(),
      user_id: userId,
      title,
      duration: parsedDuration,
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      created_at: new Date().toISOString(),
      completed: false
    };

    await upsertRecord('tasks', task);
    setTitle('');
    setDuration('30');
    setPriority('medium');
    setDeadline('');
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-800 p-6 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 space-y-4">
      <h3 className="text-lg font-semibold">New Task</h3>

      <div>
        <label className="block text-sm text-neutral-600 dark:text-neutral-400">Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="mt-1 w-full p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
          placeholder="e.g. Finish quarterly report"
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
          <label className="block text-sm text-neutral-600 dark:text-neutral-400">Priority</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as Priority)}
            className="mt-1 w-full p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm text-neutral-600 dark:text-neutral-400">Deadline (optional)</label>
        <input
          type="datetime-local"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          className="mt-1 w-full p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
        />
      </div>

      <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition">
        Add Task
      </button>
    </form>
  );
}
