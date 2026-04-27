-- ============================================================
-- Fix: Return email in profile/leaderboard RPCs so users
-- aren't shown as "Anonymous" when they haven't set a username
-- ============================================================

-- 1. Update get_user_profile to include email from auth.users
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_recent_todos json;
    v_recent_habits json;
    v_email TEXT;
BEGIN
    -- Ensure user row exists
    INSERT INTO users (id, xp, coins)
    VALUES (p_user_id, 0, 0)
    ON CONFLICT (id) DO NOTHING;

    -- Get email from auth.users
    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;

    SELECT id, username, avatar_url, xp INTO v_profile
    FROM users WHERE id = p_user_id;

    IF v_profile IS NULL THEN
        RETURN json_build_object('id', p_user_id, 'error', 'User not found');
    END IF;

    -- Get recently completed tasks
    SELECT json_agg(json_build_object(
        'id', t.id,
        'title', t.title,
        'completed_at', t.completed_at
    ) ORDER BY t.completed_at DESC)
    INTO v_recent_todos
    FROM (
        SELECT id, title, completed_at
        FROM tasks
        WHERE user_id = p_user_id
          AND completed = true
          AND completed_at IS NOT NULL
        ORDER BY completed_at DESC
        LIMIT 10
    ) t;

    -- Get recently active habits
    SELECT json_agg(json_build_object(
        'id', h.id,
        'title', h.title,
        'last_completed_date', h.last_completed_date
    ) ORDER BY h.last_completed_date DESC)
    INTO v_recent_habits
    FROM (
        SELECT id, title, last_completed_date
        FROM habits
        WHERE user_id = p_user_id
          AND last_completed_date IS NOT NULL
        ORDER BY last_completed_date DESC
        LIMIT 10
    ) h;

    RETURN json_build_object(
        'id', v_profile.id,
        'username', v_profile.username,
        'avatar_url', v_profile.avatar_url,
        'email', v_email,
        'xp', v_profile.xp,
        'level', floor(sqrt(v_profile.xp / 10.0)),
        'recent_todos', COALESCE(v_recent_todos, '[]'::json),
        'recent_habits', COALESCE(v_recent_habits, '[]'::json)
    );
END;
$$;

-- 2. Update get_group_members_leaderboard to include email
DROP FUNCTION IF EXISTS get_group_members_leaderboard(UUID);

CREATE OR REPLACE FUNCTION get_group_members_leaderboard(p_group_id UUID)
RETURNS TABLE(
    rank BIGINT,
    user_id UUID,
    username TEXT,
    email TEXT,
    level BIGINT,
    xp INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROW_NUMBER() OVER (ORDER BY us.xp DESC) AS rank,
        u.id AS user_id,
        u.username,
        au.email::text,
        floor(sqrt(us.xp / 10.0))::BIGINT AS level,
        us.xp
    FROM user_stats us
    INNER JOIN users u ON u.id = us.id
    INNER JOIN group_members gm ON gm.user_id = us.id
    LEFT JOIN auth.users au ON au.id = us.id
    WHERE gm.group_id = p_group_id
    ORDER BY us.xp DESC;
END;
$$;

-- 3. Batch email lookup for group member display
CREATE OR REPLACE FUNCTION get_user_emails(p_user_ids UUID[])
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, email FROM auth.users WHERE id = ANY(p_user_ids);
$$;
