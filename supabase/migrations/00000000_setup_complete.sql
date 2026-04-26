-- =============================================
-- FIDES - Complete Database Setup
-- Run this entire script in your Supabase SQL Editor
-- =============================================

-- 1. Create users table (apps's core user profile)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    avatar_url TEXT,
    xp INT DEFAULT 0,
    coins INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    duration INT NOT NULL DEFAULT 30,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    date DATE DEFAULT CURRENT_DATE,
    overdue BOOLEAN DEFAULT false
);

-- 3. Create habits table
CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'custom')),
    duration INT NOT NULL DEFAULT 30,
    preferred_time TEXT,
    streak INT DEFAULT 0,
    last_completed_date DATE
);

-- 4. Create calendar_entries table
CREATE TABLE IF NOT EXISTS calendar_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL
);

-- 5. Create user_stats (gamification profile)
CREATE TABLE IF NOT EXISTS user_stats (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    xp INT DEFAULT 0,
    coins INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create habit_completions (one row per habit per day)
CREATE TABLE IF NOT EXISTS habit_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    completed_at DATE DEFAULT CURRENT_DATE,
    UNIQUE(habit_id, completed_at)
);

-- 7. Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Create groups table
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES users(id) NOT NULL,
    invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Create group_members table
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(group_id, user_id)
);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(user_id, completed_at DESC) WHERE completed = true;
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_last_completed ON habits(user_id, last_completed_date DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_entries_user ON calendar_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_entries_task ON calendar_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_calendar_entries_habit ON calendar_entries(habit_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_owner_id ON groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date ON habit_completions(user_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit ON habit_completions(habit_id);
CREATE INDEX IF NOT EXISTS idx_achievements_user_type ON achievements(user_id, type);
CREATE INDEX IF NOT EXISTS idx_tasks_user_overdue ON tasks(user_id) WHERE NOT completed AND NOT overdue;
CREATE INDEX IF NOT EXISTS idx_tasks_user_deadline ON tasks(user_id, deadline);

-- =============================================
-- Row Level Security
-- =============================================

-- users: authenticated can read all; users can update own
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users are viewable by authenticated users" ON users;
CREATE POLICY "Users are viewable by authenticated users" ON users
    FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- tasks: owners can CRUD their own
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- habits: owners can CRUD their own
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own habits" ON habits;
CREATE POLICY "Users can view own habits" ON habits FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own habits" ON habits;
CREATE POLICY "Users can insert own habits" ON habits FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own habits" ON habits;
CREATE POLICY "Users can update own habits" ON habits FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own habits" ON habits;
CREATE POLICY "Users can delete own habits" ON habits FOR DELETE USING (auth.uid() = user_id);

-- calendar_entries: owners can CRUD their own
ALTER TABLE calendar_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own calendar" ON calendar_entries;
CREATE POLICY "Users can view own calendar" ON calendar_entries FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own calendar" ON calendar_entries;
CREATE POLICY "Users can insert own calendar" ON calendar_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own calendar" ON calendar_entries;
CREATE POLICY "Users can update own calendar" ON calendar_entries FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own calendar" ON calendar_entries;
CREATE POLICY "Users can delete own calendar" ON calendar_entries FOR DELETE USING (auth.uid() = user_id);

-- user_stats: owner can read/write
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stats_owner" ON user_stats;
CREATE POLICY "stats_owner" ON user_stats FOR ALL USING (auth.uid() = id);

-- habit_completions: owner can CRUD
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "completions_owner" ON habit_completions;
CREATE POLICY "completions_owner" ON habit_completions FOR ALL USING (auth.uid() = user_id);

-- achievements: owner can read
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achievements_owner" ON achievements;
CREATE POLICY "achievements_owner" ON achievements FOR ALL USING (auth.uid() = user_id);

-- groups: authenticated can read; only owner can update/delete
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Groups are viewable by authenticated users" ON groups;
CREATE POLICY "Groups are viewable by authenticated users" ON groups
    FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can create groups" ON groups;
CREATE POLICY "Users can create groups" ON groups
    FOR INSERT WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Group owner can update" ON groups;
CREATE POLICY "Group owner can update" ON groups
    FOR UPDATE USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Group owner can delete" ON groups;
CREATE POLICY "Group owner can delete" ON groups
    FOR DELETE USING (auth.uid() = owner_id);

-- group_members: members can see members in their groups
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view group members" ON group_members;
DROP POLICY IF EXISTS "Users can join groups" ON group_members;
DROP POLICY IF EXISTS "Members can leave groups" ON group_members;
CREATE POLICY "Members can view group members" ON group_members
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.owner_id = auth.uid())
    );
CREATE POLICY "Users can join groups" ON group_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can leave groups" ON group_members
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- Storage: avatars bucket
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars'
        AND auth.role() = 'authenticated'
        AND name LIKE auth.uid()::text || '/%'
    );

DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
CREATE POLICY "Avatars are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'avatars'
        AND name LIKE auth.uid()::text || '/%'
    );
CREATE POLICY "Users can join groups" ON group_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can leave groups" ON group_members
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- Storage: avatars bucket
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own avatar" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars'
        AND auth.role() = 'authenticated'
        AND name LIKE auth.uid()::text || '/%'
    );

CREATE POLICY "Avatars are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatar" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'avatars'
        AND name LIKE auth.uid()::text || '/%'
    );

-- =============================================
-- FUNCTIONS
-- =============================================

-- ensure_user_stats(): auto-create user_stats row
CREATE OR REPLACE FUNCTION ensure_user_stats(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO user_stats (id, xp, coins)
    VALUES (p_user_id, 0, 0)
    ON CONFLICT (id) DO NOTHING;
END;
$$;

-- complete_task(p_task_id UUID)
CREATE OR REPLACE FUNCTION complete_task(p_task_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
    v_completed BOOLEAN;
    v_task_count INT;
BEGIN
    SELECT user_id, completed INTO v_user_id, v_completed
    FROM tasks WHERE id = p_task_id;

    IF v_completed THEN
        RETURN;
    END IF;

    PERFORM ensure_user_stats(v_user_id);

    UPDATE tasks SET completed = true, completed_at = now() WHERE id = p_task_id;

    UPDATE user_stats
    SET xp = xp + 10,
        coins = coins + 2,
        updated_at = now()
    WHERE id = v_user_id;

    SELECT count(*) INTO v_task_count
    FROM tasks WHERE user_id = v_user_id AND completed = true;

    IF v_task_count = 1 THEN
        INSERT INTO achievements (user_id, type)
        VALUES (v_user_id, 'first_task_completed');
    END IF;

    IF v_task_count >= 50 THEN
        IF NOT EXISTS (
            SELECT 1 FROM achievements
            WHERE user_id = v_user_id AND type = 'fifty_tasks_completed'
        ) THEN
            INSERT INTO achievements (user_id, type)
            VALUES (v_user_id, 'fifty_tasks_completed');
        END IF;
    END IF;

    PERFORM check_perfect_day(v_user_id, CURRENT_DATE);
END;
$$;

-- complete_habit(p_habit_id UUID)
CREATE OR REPLACE FUNCTION complete_habit(p_habit_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
    v_streak INT;
    v_last_completed DATE;
    v_xp_reward INT := 15;
    v_coins_reward INT := 3;
BEGIN
    SELECT user_id, streak, last_completed_date
    INTO v_user_id, v_streak, v_last_completed
    FROM habits WHERE id = p_habit_id;

    IF v_last_completed = CURRENT_DATE THEN
        RETURN;
    END IF;

    IF v_last_completed = CURRENT_DATE - INTERVAL '1 day' THEN
        v_streak := v_streak + 1;
    ELSE
        v_streak := 1;
    END IF;

    IF v_streak > 3 THEN
        v_xp_reward := v_xp_reward + 5;
    END IF;

    PERFORM ensure_user_stats(v_user_id);

    UPDATE habits
    SET streak = v_streak,
        last_completed_date = CURRENT_DATE
    WHERE id = p_habit_id;

    INSERT INTO habit_completions (habit_id, user_id, completed_at)
    VALUES (p_habit_id, v_user_id, CURRENT_DATE)
    ON CONFLICT (habit_id, completed_at) DO NOTHING;

    UPDATE user_stats
    SET xp = xp + v_xp_reward,
        coins = coins + v_coins_reward,
        updated_at = now()
    WHERE id = v_user_id;

    IF v_streak >= 7 THEN
        IF NOT EXISTS (
            SELECT 1 FROM achievements
            WHERE user_id = v_user_id AND type = 'seven_day_streak'
        ) THEN
            INSERT INTO achievements (user_id, type)
            VALUES (v_user_id, 'seven_day_streak');
        END IF;
    END IF;

    PERFORM check_perfect_day(v_user_id, CURRENT_DATE);
END;
$$;

-- mark_overdue_tasks(p_user_id UUID)
CREATE OR REPLACE FUNCTION mark_overdue_tasks(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_overdue_count INT;
BEGIN
    WITH updated AS (
        UPDATE tasks
        SET overdue = true
        WHERE user_id = p_user_id
          AND deadline IS NOT NULL
          AND (deadline AT TIME ZONE 'UTC')::date < CURRENT_DATE
          AND completed = false
          AND overdue = false
        RETURNING id
    )
    SELECT count(*) INTO v_overdue_count FROM updated;

    IF v_overdue_count > 0 THEN
        UPDATE user_stats
        SET xp = GREATEST(0, xp - (5 * v_overdue_count)),
            updated_at = now()
        WHERE id = p_user_id;
    END IF;
END;
$$;

-- check_perfect_day(p_user_id UUID, p_date DATE)
CREATE OR REPLACE FUNCTION check_perfect_day(p_user_id UUID, p_date DATE)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_incomplete_tasks INT;
    v_incomplete_habits INT;
    v_already_awarded INT;
    v_total_items INT;
BEGIN
    SELECT count(*) INTO v_incomplete_tasks
    FROM tasks
    WHERE user_id = p_user_id
      AND deadline IS NOT NULL
      AND (deadline AT TIME ZONE 'UTC')::date = p_date
      AND completed = false;

    SELECT count(*) INTO v_incomplete_habits
    FROM habits h
    WHERE h.user_id = p_user_id
      AND NOT EXISTS (
        SELECT 1 FROM habit_completions hc
        WHERE hc.habit_id = h.id AND hc.completed_at = p_date
      );

    SELECT count(*) + (
        SELECT count(*) FROM habits WHERE user_id = p_user_id
    ) INTO v_total_items
    FROM tasks
    WHERE user_id = p_user_id
      AND deadline IS NOT NULL
      AND (deadline AT TIME ZONE 'UTC')::date = p_date;

    IF v_total_items = 0 THEN
        RETURN;
    END IF;

    IF v_incomplete_tasks = 0 AND v_incomplete_habits = 0 THEN
        SELECT count(*) INTO v_already_awarded
        FROM achievements
        WHERE user_id = p_user_id AND type = 'perfect_day_' || p_date::text;

        IF v_already_awarded = 0 THEN
            INSERT INTO achievements (user_id, type)
            VALUES (p_user_id, 'perfect_day_' || p_date::text);

            UPDATE user_stats
            SET xp = xp + 20,
                coins = coins + 10,
                updated_at = now()
            WHERE id = p_user_id;
        END IF;
    END IF;
END;
$$;

-- get_daily_score(p_user_id UUID, p_date DATE)
CREATE OR REPLACE FUNCTION get_daily_score(p_user_id UUID, p_date DATE)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_tasks INT;
    v_completed_tasks INT;
    v_total_habits INT;
    v_completed_habits INT;
    v_total INT;
    v_completed INT;
    v_percentage INT;
    v_grade TEXT;
BEGIN
    SELECT count(*),
           count(*) FILTER (WHERE completed = true)
    INTO v_total_tasks, v_completed_tasks
    FROM tasks
    WHERE user_id = p_user_id
      AND deadline IS NOT NULL
      AND (deadline AT TIME ZONE 'UTC')::date = p_date;

    SELECT count(*) INTO v_total_habits
    FROM habits WHERE user_id = p_user_id;

    SELECT count(*) INTO v_completed_habits
    FROM habit_completions hc
    JOIN habits h ON h.id = hc.habit_id
    WHERE h.user_id = p_user_id
      AND hc.completed_at = p_date;

    v_total := COALESCE(v_total_tasks, 0) + COALESCE(v_total_habits, 0);
    v_completed := COALESCE(v_completed_tasks, 0) + COALESCE(v_completed_habits, 0);

    IF v_total = 0 THEN
        v_percentage := 0;
    ELSE
        v_percentage := LEAST(100, (v_completed * 100) / v_total);
    END IF;

    IF v_percentage >= 90 THEN v_grade := 'A';
    ELSIF v_percentage >= 75 THEN v_grade := 'B';
    ELSIF v_percentage >= 50 THEN v_grade := 'C';
    ELSE v_grade := 'D';
    END IF;

    RETURN json_build_object('percentage', v_percentage, 'grade', v_grade);
END;
$$;

-- get_user_progress(p_user_id UUID)
CREATE OR REPLACE FUNCTION get_user_progress(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_xp INT;
    v_level INT;
    v_next_level_xp INT;
BEGIN
    PERFORM ensure_user_stats(p_user_id);

    SELECT xp INTO v_xp FROM user_stats WHERE id = p_user_id;

    v_level := floor(sqrt(v_xp / 10.0));
    v_next_level_xp := ((v_level + 1) * (v_level + 1)) * 10;

    RETURN json_build_object(
        'xp', v_xp,
        'level', v_level,
        'next_level_xp', v_next_level_xp
    );
END;
$$;

-- get_user_stats(p_user_id UUID)
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_xp INT;
    v_coins INT;
    v_level INT;
    v_next_level_xp INT;
BEGIN
    PERFORM ensure_user_stats(p_user_id);

    SELECT xp, coins INTO v_xp, v_coins
    FROM user_stats WHERE id = p_user_id;

    v_level := floor(sqrt(v_xp / 10.0));
    v_next_level_xp := ((v_level + 1) * (v_level + 1)) * 10;

    RETURN json_build_object(
        'xp', v_xp,
        'coins', v_coins,
        'level', v_level,
        'next_level_xp', v_next_level_xp
    );
END;
$$;

-- create_group(p_name TEXT)
CREATE OR REPLACE FUNCTION create_group(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_group_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    -- Ensure user exists in users table
    INSERT INTO users (id, xp, coins)
    VALUES (v_user_id, 0, 0)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO groups (name, owner_id)
    VALUES (p_name, v_user_id)
    RETURNING id INTO v_group_id;

    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, v_user_id);

    RETURN v_group_id;
END;
$$;

-- join_group(p_invite_code TEXT)
CREATE OR REPLACE FUNCTION join_group(p_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_group_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    -- Ensure user exists in users table
    INSERT INTO users (id, xp, coins)
    VALUES (v_user_id, 0, 0)
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO v_group_id FROM groups WHERE invite_code = p_invite_code;
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite code';
    END IF;

    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, v_user_id)
    ON CONFLICT (group_id, user_id) DO NOTHING;

    RETURN v_group_id;
END;
$$;

-- leave_group(p_group_id UUID)
CREATE OR REPLACE FUNCTION leave_group(p_group_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    SELECT owner_id INTO v_owner_id FROM groups WHERE id = p_group_id;

    IF v_owner_id = auth.uid() THEN
        RAISE EXCEPTION 'Group owner cannot leave the group. Transfer ownership or delete the group.';
    END IF;

    DELETE FROM group_members WHERE group_id = p_group_id AND user_id = auth.uid();
END;
$$;

-- delete_group(p_group_id UUID)
CREATE OR REPLACE FUNCTION delete_group(p_group_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM groups WHERE id = p_group_id AND owner_id = auth.uid();
END;
$$;

-- get_group_members_leaderboard(p_group_id UUID)
CREATE OR REPLACE FUNCTION get_group_members_leaderboard(p_group_id UUID)
RETURNS TABLE(
    rank BIGINT,
    user_id UUID,
    username TEXT,
    level BIGINT,
    xp INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROW_NUMBER() OVER (ORDER BY u.xp DESC) AS rank,
        u.id AS user_id,
        u.username,
        floor(sqrt(u.xp / 10.0))::BIGINT AS level,
        u.xp
    FROM users u
    INNER JOIN group_members gm ON gm.user_id = u.id
    WHERE gm.group_id = p_group_id
    ORDER BY u.xp DESC;
END;
$$;

-- update_profile(p_username TEXT, p_avatar_url TEXT)
CREATE OR REPLACE FUNCTION update_profile(p_username TEXT, p_avatar_url TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure user row exists
    INSERT INTO users (id, xp, coins)
    VALUES (auth.uid(), 0, 0)
    ON CONFLICT (id) DO NOTHING;

    UPDATE users
    SET username = p_username,
        avatar_url = COALESCE(p_avatar_url, avatar_url)
    WHERE id = auth.uid();
END;
$$;

-- get_user_profile(p_user_id UUID)
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_recent_todos json;
    v_recent_habits json;
BEGIN
    -- Ensure user row exists
    INSERT INTO users (id, xp, coins)
    VALUES (p_user_id, 0, 0)
    ON CONFLICT (id) DO NOTHING;

    SELECT id, username, avatar_url, xp INTO v_profile
    FROM users WHERE id = p_user_id;

    IF v_profile IS NULL THEN
        RETURN json_build_object('error', 'User not found');
    END IF;

    SELECT json_agg(json_build_object(
        'id', t.id,
        'title', t.title,
        'completed_at', t.completed_at
    ) ORDER BY t.completed_at DESC)
    INTO v_recent_todos
    FROM (
        SELECT id, title, completed_at
        FROM todos
        WHERE user_id = p_user_id AND completed = true AND completed_at IS NOT NULL
        ORDER BY completed_at DESC
        LIMIT 10
    ) t;

    -- Also try tasks table
    IF v_recent_todos IS NULL THEN
        SELECT json_agg(json_build_object(
            'id', t.id,
            'title', t.title,
            'completed_at', t.completed_at
        ) ORDER BY t.completed_at DESC)
        INTO v_recent_todos
        FROM (
            SELECT id, title, completed_at
            FROM tasks
            WHERE user_id = p_user_id AND completed = true AND completed_at IS NOT NULL
            ORDER BY completed_at DESC
            LIMIT 10
        ) t;
    END IF;

    SELECT json_agg(json_build_object(
        'id', h.id,
        'title', h.title,
        'last_completed_date', h.last_completed_date
    ) ORDER BY h.last_completed_date DESC)
    INTO v_recent_habits
    FROM (
        SELECT id, title, last_completed_date
        FROM habits
        WHERE user_id = p_user_id AND last_completed_date IS NOT NULL
        ORDER BY last_completed_date DESC
        LIMIT 10
    ) h;

    RETURN json_build_object(
        'id', v_profile.id,
        'username', v_profile.username,
        'avatar_url', v_profile.avatar_url,
        'xp', v_profile.xp,
        'level', floor(sqrt(v_profile.xp / 10.0)),
        'recent_todos', COALESCE(v_recent_todos, '[]'::json),
        'recent_habits', COALESCE(v_recent_habits, '[]'::json)
    );
END;
$$;

-- ensure_user_profile() - auto-create user row on signup
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO users (id, xp, coins)
    VALUES (auth.uid(), 0, 0)
    ON CONFLICT (id) DO NOTHING;

    PERFORM ensure_user_stats(auth.uid());
END;
$$;