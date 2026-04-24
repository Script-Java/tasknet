import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskForm } from './TaskForm';
import { upsertRecord } from '../lib/store';

vi.mock('../lib/store', () => ({
  upsertRecord: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

describe('TaskForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(<TaskForm userId="user-123" onSaved={vi.fn()} />);

    expect(screen.getByText('New Task')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Duration (min)')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority')).toBeInTheDocument();
    expect(screen.getByLabelText('Deadline (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Task' })).toBeInTheDocument();
  });

  it('submits a new task with correct values and resets form', async () => {
    const mockOnSaved = vi.fn();
    render(<TaskForm userId="user-123" onSaved={mockOnSaved} />);

    const titleInput = screen.getByLabelText('Title');
    const durationInput = screen.getByLabelText('Duration (min)');
    const prioritySelect = screen.getByLabelText('Priority');
    const deadlineInput = screen.getByLabelText('Deadline (optional)');
    const submitButton = screen.getByRole('button', { name: 'Add Task' });

    fireEvent.change(titleInput, { target: { value: 'Buy groceries' } });
    fireEvent.change(durationInput, { target: { value: '45' } });
    fireEvent.change(prioritySelect, { target: { value: 'high' } });

    const testDate = '2023-12-31T23:59';
    fireEvent.change(deadlineInput, { target: { value: testDate } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(upsertRecord).toHaveBeenCalledWith('tasks', {
        id: 'test-uuid',
        user_id: 'user-123',
        title: 'Buy groceries',
        duration: 45,
        priority: 'high',
        deadline: new Date(testDate).toISOString(),
        created_at: expect.any(String),
        completed: false
      });
    });

    expect(mockOnSaved).toHaveBeenCalled();

    // Verify form resets
    expect((titleInput as HTMLInputElement).value).toBe('');
    expect((durationInput as HTMLInputElement).value).toBe('30');
    expect((prioritySelect as HTMLSelectElement).value).toBe('medium');
    expect((deadlineInput as HTMLInputElement).value).toBe('');
  });

  it('submits a task with no deadline correctly', async () => {
    const mockOnSaved = vi.fn();
    render(<TaskForm userId="user-123" onSaved={mockOnSaved} />);

    const titleInput = screen.getByLabelText('Title');
    const submitButton = screen.getByRole('button', { name: 'Add Task' });

    fireEvent.change(titleInput, { target: { value: 'No deadline task' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(upsertRecord).toHaveBeenCalledWith('tasks', expect.objectContaining({
        title: 'No deadline task',
        deadline: null,
      }));
    });
  });

  it('does not submit if title is empty', async () => {
    const mockOnSaved = vi.fn();
    render(<TaskForm userId="user-123" onSaved={mockOnSaved} />);

    const submitButton = screen.getByRole('button', { name: 'Add Task' });
    fireEvent.click(submitButton);

    expect(upsertRecord).not.toHaveBeenCalled();
    expect(mockOnSaved).not.toHaveBeenCalled();
  });
});
