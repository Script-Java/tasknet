-- =============================================
-- TaskNet Social & Profile System Migration
-- =============================================

-- 1. Add profile fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Add completed_at to todos
ALTER TABLE todos ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Update existing completed todos to set completed_at if null
UPDATE todos SET completed_at = now() WHERE completed = true AND completed_at IS NULL;

-- 3. Create groups table
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES users(id) NOT NULL,
    invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create group_members table
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(group_id, user_id)
);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_owner_id ON groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_todos_completed_at ON todos(user_id, completed_at DESC) WHERE completed = true;
CREATE INDEX IF NOT EXISTS idx_habits_user_last_completed ON habits(user_id, last_completed_date DESC);

-- =============================================
-- Row Level Security
-- =============================================

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Groups: anyone authenticated can read; only owner can update/delete; members can see their groups
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

-- Group members: members can see other members in their groups
DROP POLICY IF EXISTS "Members can view group members" ON group_members;
CREATE POLICY "Members can view group members" ON group_members
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can join groups" ON group_members;
CREATE POLICY "Users can join groups" ON group_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can leave groups" ON group_members;
CREATE POLICY "Members can leave groups" ON group_members
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- Functions
-- =============================================

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
BEGIN
    SELECT id INTO v_group_id FROM groups WHERE invite_code = p_invite_code;
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite code';
    END IF;

    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, auth.uid())
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

-- ensure_user_profile() - auto-create user row on signup if missing
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO users (id, xp, coins)
    VALUES (auth.uid(), 0, 0)
    ON CONFLICT (id) DO NOTHING;
END;
$$;