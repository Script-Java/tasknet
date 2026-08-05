import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HabitForm } from './HabitForm';
import { upsertRecord } from '../lib/store';

vi.mock('../lib/store', () => ({
  upsertRecord: vi.fn(),
}));

// Mock uuid to have predictable output for assertions if needed
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

describe('HabitForm', () => {
  const mockOnSaved = vi.fn();
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<HabitForm userId={userId} onSaved={mockOnSaved} />);

    expect(screen.getByText('New Habit')).toBeInTheDocument();

    // Instead of getByLabelText, we can use placeholder or roles since the label lacks 'htmlFor'
    expect(screen.getByPlaceholderText('e.g. Gym every day')).toBeInTheDocument();

    // Duration input starts with value 30
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();

    // Frequency select
    expect(screen.getByDisplayValue('Daily')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Add Habit' })).toBeInTheDocument();
  });

  it('does not submit without a title', async () => {
    render(<HabitForm userId={userId} onSaved={mockOnSaved} />);

    // Default form behavior on button click when title is empty and input has "required" attribute
    // React Testing Library usually lets it through if we just call fireEvent.click but we can
    // test the handleSubmit directly by submitting the form.
    fireEvent.submit(screen.getByRole('button', { name: 'Add Habit' }));

    expect(upsertRecord).not.toHaveBeenCalled();
    expect(mockOnSaved).not.toHaveBeenCalled();
  });

  it('submits correctly with full data', async () => {
    render(<HabitForm userId={userId} onSaved={mockOnSaved} />);

    // Fill out form
    fireEvent.change(screen.getByPlaceholderText('e.g. Gym every day'), { target: { value: 'Read a book' } });
    fireEvent.change(screen.getByDisplayValue('30'), { target: { value: '45' } });
    fireEvent.change(screen.getByDisplayValue('Daily'), { target: { value: 'weekly' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'Add Habit' }));

    await waitFor(() => {
      expect(upsertRecord).toHaveBeenCalledWith('habits', {
        id: 'test-uuid-1234',
        user_id: userId,
        title: 'Read a book',
        frequency: 'weekly',
        duration: 45,
      });
    });

    expect(mockOnSaved).toHaveBeenCalled();
  });
});
