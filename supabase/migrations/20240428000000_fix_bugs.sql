-- ============================================================
-- Fix: RLS recursion, missing RPCs, task deletion with XP revoke
-- ============================================================

-- ============================================================
-- 1. Fix RLS infinite recursion on group_members
--    The old SELECT policy queried group_members from within
--    the group_members policy, causing infinite recursion.
-- ============================================================

-- Drop old group_members policies
DROP POLICY IF EXISTS "Members can view group members" ON group_members;
DROP POLICY IF EXISTS "Users can join groups" ON group_members;
DROP POLICY IF EXISTS "Members can leave groups" ON group_members;

-- Drop old groups policies (recreate clean)
DROP POLICY IF EXISTS "Groups are viewable by authenticated users" ON groups;
DROP POLICY IF EXISTS "Users can create groups" ON groups;
DROP POLICY IF EXISTS "Group owner can update" ON groups;
DROP POLICY IF EXISTS "Group owner can delete" ON groups;

-- New groups policies (no recursion, simple)
CREATE POLICY "Groups are viewable by authenticated users" ON groups
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create groups" ON groups
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Group owner can update" ON groups
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Group owner can delete" ON groups
    FOR DELETE USING (auth.uid() = owner_id);

-- New group_members policies (authenticated users can see all,
-- but insert/delete are scoped to the current user)
CREATE POLICY "Group members viewable by authenticated" ON group_members
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can join groups" ON group_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can leave groups" ON group_members
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 2. Fix get_user_profile RPC
--    The old version referenced a non-existent 'todos' table.
--    This version uses the correct 'tasks' table.
-- ============================================================

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
        'xp', v_profile.xp,
        'level', floor(sqrt(v_profile.xp / 10.0)),
        'recent_todos', COALESCE(v_recent_todos, '[]'::json),
        'recent_habits', COALESCE(v_recent_habits, '[]'::json)
    );
END;
$$;

-- ============================================================
-- 3. Create delete_task_and_revoke_xp RPC
--    If the task is completed, subtracts the XP and coins
--    awarded for it, then deletes the task. Prevents XP farming.
-- ============================================================

CREATE OR REPLACE FUNCTION delete_task_and_revoke_xp(p_task_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_completed BOOLEAN;
    v_priority TEXT;
    v_xp_deduct INT := 0;
    v_coins_deduct INT := 0;
BEGIN
    SELECT user_id, completed, priority
    INTO v_user_id, v_completed, v_priority
    FROM tasks WHERE id = p_task_id;

    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    IF v_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Not authorized to delete this task';
    END IF;

    IF v_completed THEN
        CASE v_priority
            WHEN 'low' THEN
                v_xp_deduct := 5;
                v_coins_deduct := 1;
            WHEN 'medium' THEN
                v_xp_deduct := 10;
                v_coins_deduct := 2;
            WHEN 'high' THEN
                v_xp_deduct := 15;
                v_coins_deduct := 3;
            ELSE
                v_xp_deduct := 10;
                v_coins_deduct := 2;
        END CASE;

        UPDATE user_stats
        SET xp = GREATEST(0, xp - v_xp_deduct),
            coins = GREATEST(0, coins - v_coins_deduct),
            updated_at = now()
        WHERE id = v_user_id;
    END IF;

    -- Also remove the corresponding achievement records that
    -- might have been triggered by this specific task
    DELETE FROM achievements
    WHERE user_id = v_user_id
      AND type = 'first_task_completed'
      AND NOT EXISTS (
        SELECT 1 FROM tasks
        WHERE user_id = v_user_id AND completed = true AND id != p_task_id
      );

    DELETE FROM achievements
    WHERE user_id = v_user_id
      AND type = 'fifty_tasks_completed'
      AND (
        SELECT count(*) FROM tasks
        WHERE user_id = v_user_id AND completed = true AND id != p_task_id
      ) < 50;

    -- Delete the task
    DELETE FROM tasks WHERE id = p_task_id;
END;
$$; 
