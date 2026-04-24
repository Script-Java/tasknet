// @vitest-environment jsdom
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NaturalInput } from './NaturalInput';
import toast from 'react-hot-toast';

vi.mock('react-hot-toast', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockToast = vi.fn() as any;
  mockToast.error = vi.fn();
  mockToast.success = vi.fn();
  mockToast.dismiss = vi.fn();
  return {
    default: mockToast
  };
});

vi.mock('../lib/nlp', () => ({
  parseNaturalLanguageInput: vi.fn(),
}));

vi.mock('../lib/store', () => ({
  upsertRecord: vi.fn(),
}));

describe('NaturalInput Error Handling', () => {
  const originalSpeechRecognition = window.SpeechRecognition;
  const originalWebkitSpeechRecognition = window.webkitSpeechRecognition;

  beforeEach(() => {
    vi.clearAllMocks();
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });

  afterEach(() => {
    cleanup();
    window.SpeechRecognition = originalSpeechRecognition;
    window.webkitSpeechRecognition = originalWebkitSpeechRecognition;
  });

  it('shows error toast when SpeechRecognition is not supported', async () => {
    // Both are undefined due to beforeEach
    const { getByRole } = render(<NaturalInput userId="user1" onSaved={vi.fn()} />);

    const micButton = getByRole('button', { name: 'Start voice input' });
    fireEvent.click(micButton);

    expect(toast.error).toHaveBeenCalledWith('Speech recognition is not supported in this browser.');
  });

  it('catches and logs error when recognition.start() throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockStart = vi.fn().mockImplementation(() => {
      throw new Error('Already started');
    });

    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = 'en-US';
      start = mockStart;
      stop = vi.fn();
      onresult = vi.fn();
      onerror = vi.fn();
      onend = vi.fn();
    }

    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition;

    const { getByRole } = render(<NaturalInput userId="user1" onSaved={vi.fn()} />);

    const micButton = getByRole('button', { name: 'Start voice input' });
    fireEvent.click(micButton);

    expect(mockStart).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));

    consoleErrorSpy.mockRestore();
  });

  it('handles onerror event correctly', async () => {
    let mockOnError: ((event: { error: string }) => void) | undefined;

    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = 'en-US';
      start = vi.fn();
      stop = vi.fn();
      onresult = vi.fn();
      onend = vi.fn();

      set onerror(fn: (event: { error: string }) => void) {
        mockOnError = fn;
      }
    }

    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition;

    render(<NaturalInput userId="user1" onSaved={vi.fn()} />);

    // Simulate error event
    if (mockOnError) {
      mockOnError({ error: 'not-allowed' });
    }

    expect(toast.dismiss).toHaveBeenCalledWith('listening');
    expect(toast.error).toHaveBeenCalledWith('Speech recognition error: not-allowed');
  });
});
