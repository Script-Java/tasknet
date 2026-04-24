import React, { useState, useRef, useEffect } from 'react';
import { parseNaturalLanguageInput } from '../lib/nlp';
import { upsertRecord } from '../lib/store';
import { Mic, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Setup SpeechRecognition types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function NaturalInput({ userId, onSaved }: { userId: string, onSaved: () => void }) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        setInput(() => {
          // If we have final transcript, append it to what we had before starting recognition,
          // but since continuous is false, the whole result usually comes in one or a few events.
          // For a simpler approach, just replace the input with the combined transcript.
          // To avoid overwriting existing text the user might have typed, let's just
          // replace everything with the new speech if they started speaking while it was empty,
          // or append if we want. For now, matching standard behavior: just show what they are saying.
          return finalTranscript || interimTranscript;
        });
      };

      recognitionRef.current.onerror = (event: any) => {
        setIsListening(false);
        toast.dismiss('listening');
        toast.error('Speech recognition error: ' + event.error);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        toast.dismiss('listening');
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        toast.error('Speech recognition is not supported in this browser.');
        return;
      }
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast('Listening...', { icon: '🎙️', id: 'listening' });
      } catch (e) {
        // Handle case where it's already started
        console.error(e);
      }
    }
  };

  const submitInput = async (textToSubmit: string = input) => {
    if (!textToSubmit.trim()) return;

    const parsed = parseNaturalLanguageInput(textToSubmit, userId);
    if (parsed) {
      if (parsed.type === 'task') {
        await upsertRecord('tasks', parsed.data);
        toast.success(`Task created: ${parsed.data.title}`);
      } else {
        await upsertRecord('habits', parsed.data);
        toast.success(`Habit created: ${parsed.data.title}`);
      }
      setInput('');
      onSaved();
    } else {
      toast.error('Could not understand input.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitInput();
  };

  return (
    <form onSubmit={handleSubmit} className="relative group">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
      <div className={`relative bg-white/90 dark:bg-neutral-800/90 backdrop-blur-xl p-2 pl-6 rounded-2xl shadow-xl border ${isListening ? 'border-blue-400 dark:border-blue-500' : 'border-white/50 dark:border-white/5'} flex items-center space-x-2 transition-all`}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Try 'Gym every day at 6pm' or 'Finish project by Friday'"
          aria-label="Task or habit description"
          className="flex-1 bg-transparent border-none focus:ring-0 text-lg font-medium text-neutral-900 dark:text-neutral-100 placeholder-neutral-400/70 py-3"
        />
        <div className="flex items-center space-x-1 pr-2">
            <button
                type="button"
                onClick={toggleListening}
                aria-label={isListening ? "Stop listening" : "Start voice input"}
                title={isListening ? "Stop listening" : "Start voice input"}
                className={`p-3 rounded-xl transition-all ${isListening ? 'bg-red-100 text-red-500 dark:bg-red-900/30' : 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-blue-500'}`}
            >
                {isListening ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
            </button>
            <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Submit"
                title="Submit"
                className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20"
            >
                <Send className="w-6 h-6" />
            </button>
        </div>
      </div>
    </form>
  );
}
