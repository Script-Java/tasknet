-- Migration for Social + Profile System

-- 12. USER PROFILE SYSTEM
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 14. COMPLETION HISTORY (MINIMAL)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- 9. GROUP SYSTEM (CORE SOCIAL FEATURE)
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES users(id) NOT NULL,
    invite_code TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT now(),
    UNIQUE(group_id, user_id)
);

-- Update complete_todo to also set completed_at
CREATE OR REPLACE FUNCTION complete_todo(p_todo_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
    v_completed BOOLEAN;
    v_todo_count INT;
BEGIN
    SELECT user_id, completed INTO v_user_id, v_completed
    FROM todos WHERE id = p_todo_id;

    IF v_completed THEN
        RETURN; -- Already completed
    END IF;

    -- Mark completed and set completed_at
    UPDATE todos SET completed = true, completed_at = now() WHERE id = p_todo_id;

    -- Award XP and coins
    UPDATE users
    SET xp = xp + 10,
        coins = coins + 2
    WHERE id = v_user_id;

    -- Check achievements
    SELECT count(*) INTO v_todo_count FROM todos WHERE user_id = v_user_id AND completed = true;

    IF v_todo_count = 1 THEN
        INSERT INTO achievements (user_id, type) VALUES (v_user_id, 'First task completed');
    END IF;

    IF v_todo_count = 50 THEN
        INSERT INTO achievements (user_id, type) VALUES (v_user_id, '50 todos completed');
    END IF;

    -- Check perfect day
    PERFORM check_perfect_day(v_user_id, CURRENT_DATE);
END;
$$;

-- Create Group
CREATE OR REPLACE FUNCTION create_group(p_name TEXT, p_owner_id UUID, p_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_group_id UUID;
BEGIN
    INSERT INTO groups (name, owner_id, invite_code)
    VALUES (p_name, p_owner_id, p_invite_code)
    RETURNING id INTO v_group_id;

    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, p_owner_id);

    RETURN v_group_id;
END;
$$;

-- Join Group
CREATE OR REPLACE FUNCTION join_group(p_user_id UUID, p_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_group_id UUID;
BEGIN
    SELECT id INTO v_group_id FROM groups WHERE invite_code = p_invite_code;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite code';
    END IF;

    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, p_user_id)
    ON CONFLICT (group_id, user_id) DO NOTHING;

    RETURN v_group_id;
END;
$$;

-- Leave Group
CREATE OR REPLACE FUNCTION leave_group(p_user_id UUID, p_group_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM group_members WHERE group_id = p_group_id AND user_id = p_user_id;
END;
$$;

-- Get Group Leaderboard
CREATE OR REPLACE FUNCTION get_group_leaderboard(p_group_id UUID)
RETURNS TABLE (
    rank BIGINT,
    user_id UUID,
    username TEXT,
    level INT,
    xp INT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH RankedUsers AS (
        SELECT
            u.id as uid,
            u.username as uname,
            u.xp as uxp,
            floor(sqrt(u.xp / 10.0))::INT as ulevel
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = p_group_id
    )
    SELECT
        row_number() OVER (ORDER BY uxp DESC) as rank,
        uid as user_id,
        uname as username,
        ulevel as level,
        uxp as xp
    FROM RankedUsers
    ORDER BY uxp DESC;
END;
$$;

-- Update Profile
CREATE OR REPLACE FUNCTION update_profile(p_user_id UUID, p_username TEXT, p_avatar_url TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE users
    SET username = COALESCE(p_username, username),
        avatar_url = COALESCE(p_avatar_url, avatar_url)
    WHERE id = p_user_id;
END;
$$;

-- Get User Profile (with recent activity)
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_user RECORD;
    v_recent_todos json;
    v_recent_habits json;
BEGIN
    SELECT username, xp, floor(sqrt(xp / 10.0))::INT as level INTO v_user
    FROM users WHERE id = p_user_id;

    IF v_user IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT json_agg(t) INTO v_recent_todos
    FROM (
        SELECT id, due_date, completed_at
        FROM todos
        WHERE user_id = p_user_id AND completed = true
        ORDER BY completed_at DESC NULLS LAST
        LIMIT 5
    ) t;

    SELECT json_agg(h) INTO v_recent_habits
    FROM (
        SELECT id, streak, last_completed_date
        FROM habits
        WHERE user_id = p_user_id AND last_completed_date IS NOT NULL
        ORDER BY last_completed_date DESC
        LIMIT 5
    ) h;

    RETURN json_build_object(
        'username', v_user.username,
        'level', v_user.level,
        'xp', v_user.xp,
        'recent_completed_todos', COALESCE(v_recent_todos, '[]'::json),
        'recent_completed_habits', COALESCE(v_recent_habits, '[]'::json)
    );
END;
$$;
