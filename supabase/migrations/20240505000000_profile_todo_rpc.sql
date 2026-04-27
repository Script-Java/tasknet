-- ============================================================
-- Profile Todo RPCs — returns a specific user's incomplete
-- tasks and habits. Authorized if caller is the user OR
-- shares a group with them.
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_profile_tasks(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    title TEXT,
    duration INT,
    priority TEXT,
    deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF auth.uid() != p_user_id AND NOT EXISTS (
        SELECT 1 FROM group_members gm1
        JOIN group_members gm2 ON gm1.group_id = gm2.group_id
        WHERE gm1.user_id = auth.uid() AND gm2.user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT t.id, t.title, t.duration, t.priority, t.deadline, t.created_at
    FROM tasks t
    WHERE t.user_id = p_user_id AND t.completed = false
    ORDER BY t.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_profile_habits(p_user_id UUID)
RETURNS TABLE(
    id UUID,
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
    IF auth.uid() != p_user_id AND NOT EXISTS (
        SELECT 1 FROM group_members gm1
        JOIN group_members gm2 ON gm1.group_id = gm2.group_id
        WHERE gm1.user_id = auth.uid() AND gm2.user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT h.id, h.title, h.frequency, h.duration, h.streak, h.last_completed_date
    FROM habits h
    WHERE h.user_id = p_user_id
    ORDER BY h.title;
END;
$$;