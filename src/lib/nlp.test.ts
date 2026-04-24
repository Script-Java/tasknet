import { describe, it, expect, vi } from 'vitest';
import { parseNaturalLanguageInput } from './nlp';

// Mock uuid to have consistent IDs in tests
vi.mock('uuid', () => ({
  v4: () => 'mocked-uuid'
}));

describe('parseNaturalLanguageInput', () => {
  const userId = 'user-123';

  // 1. Habits testing
  describe('Habits', () => {
    it('should correctly parse a daily habit', () => {
      const result = parseNaturalLanguageInput('Read 10 pages every day', userId);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('habit');
      expect(result?.data.title).toBe('Read 10 pages every day');
      expect((result?.data as any).frequency).toBe('daily');
      expect(result?.data.id).toBe('mocked-uuid');
      expect(result?.data.user_id).toBe(userId);
      expect(result?.data.duration).toBe(30);
    });

    it('should correctly parse a daily habit using "daily"', () => {
      const result = parseNaturalLanguageInput('Read 10 pages daily', userId);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('habit');
      expect(result?.data.title).toBe('Read 10 pages daily');
      expect((result?.data as any).frequency).toBe('daily');
      expect(result?.data.id).toBe('mocked-uuid');
      expect(result?.data.user_id).toBe(userId);
      expect(result?.data.duration).toBe(30);
    });


    it('should correctly parse a weekly habit', () => {
      const result = parseNaturalLanguageInput('Go to gym weekly', userId);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('habit');
      expect(result?.data.title).toBe('Go to gym weekly');
      expect((result?.data as any).frequency).toBe('weekly');
    });
  });

  // 2. Tasks testing
  describe('Tasks', () => {
    it('should correctly parse a simple task', () => {
      const result = parseNaturalLanguageInput('Buy groceries', userId);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('task');
      expect(result?.data.title).toBe('Buy groceries');
      expect((result?.data as any).priority).toBe('medium');
      expect(result?.data.duration).toBe(30);
      expect((result?.data as any).completed).toBe(false);
      expect(result?.data.id).toBe('mocked-uuid');
    });

    it('should correctly parse an urgent task', () => {
      const result = parseNaturalLanguageInput('Urgent fix bug', userId);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('task');
      expect(result?.data.title).toBe('Urgent fix bug');
      expect((result?.data as any).priority).toBe('high');
    });

    it('should correctly extract dates from task input', () => {
      const result = parseNaturalLanguageInput('Finish report by tomorrow', userId);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('task');
      // "by tomorrow" is stripped by chrono + trailing stop word regex
      expect(result?.data.title).toBe('Finish report');
      expect((result?.data as any).deadline).toBeTruthy();
    });

    it('should fallback to input string as title if title becomes empty', () => {
      // Create a scenario where removing dates leaves the title empty
      const result = parseNaturalLanguageInput('tomorrow', userId);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('task');
      expect(result?.data.title).toBe('tomorrow');
      expect((result?.data as any).deadline).toBeTruthy();
    });

    it('should strip trailing prepositions', () => {
      const result = parseNaturalLanguageInput('Dinner at 8pm', userId);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('task');
      // "at 8pm" is parsed as date, leaving "Dinner at", and trailing "at" should be stripped
      expect(result?.data.title).toBe('Dinner');
      expect((result?.data as any).deadline).toBeTruthy();
    });
  });
});
