import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseNaturalLanguageInput } from './nlp';

vi.mock('uuid', () => ({
  v4: () => 'mocked-uuid'
}));

describe('parseNaturalLanguageInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-10-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const userId = 'user-123';

  it('should parse a basic task without a date', () => {
    const result = parseNaturalLanguageInput('Buy milk', userId);
    expect(result).toEqual({
      type: 'task',
      data: {
        id: 'mocked-uuid',
        user_id: userId,
        title: 'Buy milk',
        duration: 30,
        priority: 'medium',
        deadline: null,
        created_at: '2023-10-15T12:00:00.000Z',
        completed: false
      }
    });
  });

  it('should parse a task with a date', () => {
    const result = parseNaturalLanguageInput('Finish report by tomorrow', userId);
    expect(result?.type).toBe('task');
    expect(result?.data.title).toBe('Finish report');
    // Note: chrono.parseDate depends on system time.
    // 'tomorrow' at 12:00Z will be the next day at 12:00.
    expect(result?.data.deadline).toBe(new Date('2023-10-16T12:00:00.000Z').toISOString());
  });

  it('should detect high priority tasks', () => {
    const inputs = ['urgent fix bug', 'call doctor asap', 'important meeting'];
    for (const input of inputs) {
      const result = parseNaturalLanguageInput(input, userId);
      expect(result?.type).toBe('task');
      expect((result?.data as any).priority).toBe('high');
    }
  });

  it('should parse a basic habit', () => {
    // "daily" is not extracted by chrono.parse as a date usually,
    // let's just see how it behaves.
    const result = parseNaturalLanguageInput('Read 10 pages daily', userId);
    expect(result).toEqual({
      type: 'habit',
      data: {
        id: 'mocked-uuid',
        user_id: userId,
        title: 'Read 10 pages daily', // chrono may or may not remove 'daily'
        frequency: 'daily',
        duration: 30,
        preferred_time: null
      }
    });
  });

  it('should parse a weekly habit', () => {
    const result = parseNaturalLanguageInput('Call mom weekly', userId);
    expect(result?.type).toBe('habit');
    expect((result?.data as any).frequency).toBe('weekly');
  });

  it('should fall back to original input if title is empty', () => {
    const result = parseNaturalLanguageInput('tomorrow', userId);
    expect(result?.data.title).toBe('tomorrow');
  });

  it('should strip trailing stop words like "at", "by", "on"', () => {
    const result = parseNaturalLanguageInput('Go to gym by tomorrow', userId);
    expect(result?.data.title).toBe('Go to gym');
  });
});
