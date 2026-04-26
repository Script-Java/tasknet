import React, { useState, useRef, useEffect, useCallback } from 'react';
import { parseNaturalLanguageInput } from '../lib/nlp';
import { upsertRecord } from '../lib/store';
import { Mic, Send, MicOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionLike;
    webkitSpeechRecognition: new () => SpeechRecognitionLike;
  }
}

export function NaturalInput({ userId, onSaved }: { userId: string, onSaved: () => void }) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isListeningRef = useRef(false);
  const inputRef = useRef('');
  const retryCountRef = useRef(0);
  const inputElRef = useRef<HTMLInputElement | null>(null);
  const MAX_RETRIES = 3;

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }

    retryCountRef.current = 0;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
    };

    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
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

      const newTranscript = finalTranscript || interimTranscript;
      if (newTranscript) {
        inputRef.current = newTranscript;
        setInput(newTranscript);
      }
    };

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      isListeningRef.current = false;
      setIsListening(false);

      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        toast.error('Microphone access denied. Please allow microphone in your browser settings.');
      } else if (event.error !== 'aborted') {
        toast.error('Speech recognition error: ' + event.error);
      }
    };

    recognitionRef.current.onend = () => {
      if (isListeningRef.current) {
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          try {
            recognitionRef.current?.start();
          } catch {
            isListeningRef.current = false;
            setIsListening(false);
          }
        } else {
          isListeningRef.current = false;
          setIsListening(false);
          toast.error('Speech recognition stopped. Please try again.');
        }
      } else {
        setIsListening(false);
      }
    };

    try {
      recognitionRef.current.start();
    } catch (e) {
      isListeningRef.current = false;
      setIsListening(false);
      toast.error('Could not start speech recognition');
    }
  }, []);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === 'n' &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        inputElRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const submitInput = async (textToSubmit: string = input) => {
    if (!textToSubmit.trim() || isParsing) return;

    setIsParsing(true);
    try {
      const parsed = await parseNaturalLanguageInput(textToSubmit, userId);
      if (parsed) {
        if (parsed.type === 'task') {
          await upsertRecord('tasks', parsed.data);
          toast.success(`Task created: ${parsed.data.title}`);
        } else {
          await upsertRecord('habits', parsed.data);
          toast.success(`Habit created: ${parsed.data.title}`);
        }
        setInput('');
        inputRef.current = '';
        onSaved();
      } else {
        toast.error('Could not understand input.');
      }
    } catch {
      toast.error('Failed to parse input. Please try again.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitInput();
  };

  return (
    <form onSubmit={handleSubmit} className="relative group">
      <div className="absolute inset-0 bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] rounded-2xl blur opacity-10 group-hover:opacity-20 transition duration-500"></div>
      <div className={`relative galaxy-card p-2 pl-5 flex items-center space-x-2 ${isListening ? '!border-[#EF5350]' : ''}`}>
        <input
          ref={inputElRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Try 'Gym every day at 6pm' or 'Finish project by Friday'"
          aria-label="Task or habit description"
          className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-[15px] font-medium text-[#EEEEF8] placeholder-[#5C5780] py-3"
        />
        <div className="flex items-center space-x-1.5 pr-1.5">
          {isSupported && (
            <button
              type="button"
              onClick={toggleListening}
              aria-label={isListening ? "Stop listening" : "Start voice input"}
              title={isListening ? "Stop listening" : "Start voice input"}
              className={`p-2.5 rounded-xl transition-all ${
                isListening
                  ? 'bg-[rgba(239,83,80,0.15)] text-[#EF5350] animate-pulse'
                  : 'text-[#5C5780] hover:text-[#A78BFA] hover:bg-[rgba(139,92,246,0.08)]'
              }`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <button
            type="submit"
            disabled={!input.trim() || isParsing}
            aria-label="Submit"
            title="Submit"
            className="p-2.5 bg-[#8B5CF6] text-white rounded-xl hover:bg-[#A78BFA] disabled:opacity-30 disabled:hover:bg-[#8B5CF6] transition-all shadow-md shadow-[#8B5CF6]/25"
          >
            {isParsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </form>
  );
}
