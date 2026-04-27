-- ============================================================
-- Group Member Tasks & Habits — read-only SECURITY DEFINER RPCs
-- Only group members can view each other's tasks/habits.
-- RLS bypass is safe because we explicitly check membership
-- inside the function before returning data.
-- ============================================================

CREATE OR REPLACE FUNCTION get_group_member_tasks(p_group_id UUID)
RETURNS TABLE(
    user_id UUID,
    username TEXT,
    task_id UUID,
    title TEXT,
    completed BOOLEAN,
    priority TEXT,
    deadline TIMESTAMPTZ,
    duration INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not a member of this group';
    END IF;

    RETURN QUERY
    SELECT
        u.id,
        u.username,
        t.id,
        t.title,
        t.completed,
        t.priority,
        t.deadline,
        t.duration
    FROM tasks t
    JOIN users u ON u.id = t.user_id
    JOIN group_members gm ON gm.user_id = t.user_id
    WHERE gm.group_id = p_group_id
    ORDER BY u.id, t.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_group_member_habits(p_group_id UUID)
RETURNS TABLE(
    user_id UUID,
    username TEXT,
    habit_id UUID,
    title TEXT,
    frequency TEXT,
    duration INT,
    streak INT,
    last_completed_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not a member of this group';
    END IF;

    RETURN QUERY
    SELECT
        u.id,
        u.username,
        h.id,
        h.title,
        h.frequency,
        h.duration,
        h.streak,
        h.last_completed_date
    FROM habits h
    JOIN users u ON u.id = h.user_id
    JOIN group_members gm ON gm.user_id = h.user_id
    WHERE gm.group_id = p_group_id
    ORDER BY u.id, h.title;
END;
$$;