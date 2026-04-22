import React, { useState } from 'react';
import { parseNaturalLanguageInput } from '../lib/nlp';
import { upsertRecord } from '../lib/store';
import { Mic, Send } from 'lucide-react';

export function NaturalInput({ userId, onSaved }: { userId: string, onSaved: () => void }) {
  const [input, setInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const parsed = parseNaturalLanguageInput(input, userId);
    if (parsed) {
      if (parsed.type === 'task') {
        await upsertRecord('tasks', parsed.data);
      } else {
        await upsertRecord('habits', parsed.data);
      }
      setInput('');
      onSaved();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-neutral-800 p-4 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 flex items-center space-x-2">
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Try 'Gym every day at 6pm' or 'Finish project by Friday'"
        className="flex-1 bg-transparent border-none focus:ring-0 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
      />
      <button type="button" className="p-2 text-neutral-400 hover:text-blue-500 transition">
        <Mic className="w-5 h-5" />
      </button>
      <button type="submit" className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition">
        <Send className="w-5 h-5" />
      </button>
    </form>
  );
}
