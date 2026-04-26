import React, { useState } from 'react';

import type { Task, Priority } from '../lib/types';
import { upsertRecord } from '../lib/store';
import { Plus } from 'lucide-react';

export function TaskForm({ userId, onSaved }: { userId: string, onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('30');
  const [priority, setPriority] = useState<Priority>('medium');
  const [deadline, setDeadline] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const task: Task = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      duration: parseInt(duration),
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      created_at: new Date().toISOString(),
      completed: false,
      date: new Date().toISOString().split('T')[0]
    };

    await upsertRecord('tasks', task);
    setTitle('');
    setDuration('30');
    setPriority('medium');
    setDeadline('');
    onSaved();
  };

  const priorityOptions: { value: Priority; label: string; color: string }[] = [
    { value: 'low', label: 'Low', color: 'text-[#66BB6A]' },
    { value: 'medium', label: 'Medium', color: 'text-[#FFB74D]' },
    { value: 'high', label: 'High', color: 'text-[#EF5350]' },
  ];

  return (
    <form onSubmit={handleSubmit} className="galaxy-card p-4 md:p-6 space-y-5">
      <h3 className="text-lg font-bold text-[#EEEEF8]">New Task</h3>

      <div>
        <label className="block text-sm font-medium text-[#8E89B3] mb-1.5">Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="galaxy-input"
          placeholder="e.g. Finish quarterly report"
          required
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
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
          <label className="block text-sm font-medium text-[#8E89B3] mb-1.5">Priority</label>
          <div className="flex gap-2">
            {priorityOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPriority(opt.value)}
                className={`flex-1 py-2.5 px-2 md:px-3 rounded-xl text-sm font-semibold transition-all border ${
                  priority === opt.value
                    ? `bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.3)] ${opt.color}`
                    : 'bg-[rgba(13,11,30,0.4)] border-[#2A2545] text-[#5C5780] hover:text-[#8E89B3]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#8E89B3] mb-1.5">Deadline (optional)</label>
        <input
          type="datetime-local"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          className="galaxy-input"
        />
      </div>

      <button type="submit" className="galaxy-btn w-full flex items-center justify-center space-x-2">
        <Plus className="w-5 h-5" />
        <span>Add Task</span>
      </button>
    </form>
  );
}