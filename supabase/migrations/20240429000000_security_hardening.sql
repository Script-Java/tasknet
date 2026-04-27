-- ============================================================
-- Performance, Security & Integrity Hardening Migration
-- Only creates/replaces what is needed without conflicting
-- with earlier migrations.
-- ============================================================

-- ============================================================
-- 2.1: Harden gamification RPCs - Authorization checks
-- ============================================================

-- complete_task: verify ownership before awarding XP
CREATE OR REPLACE FUNCTION complete_task(p_task_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
    v_completed BOOLEAN;
    v_priority TEXT;
    v_task_count INT;
    v_xp_reward INT := 10;
    v_coins_reward INT := 2;
BEGIN
    SELECT user_id, completed, priority INTO v_user_id, v_completed, v_priority
    FROM tasks WHERE id = p_task_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    IF v_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF v_completed THEN
        RETURN;
    END IF;

    CASE v_priority
        WHEN 'low' THEN
            v_xp_reward := 5;
            v_coins_reward := 1;
        WHEN 'medium' THEN
            v_xp_reward := 10;
            v_coins_reward := 2;
        WHEN 'high' THEN
            v_xp_reward := 15;
            v_coins_reward := 3;
        ELSE
            v_xp_reward := 10;
            v_coins_reward := 2;
    END CASE;

    PERFORM ensure_user_stats(v_user_id);

    UPDATE tasks SET completed = true, completed_at = now() WHERE id = p_task_id;

    UPDATE user_stats
    SET xp = xp + v_xp_reward,
        coins = coins + v_coins_reward,
        updated_at = now()
    WHERE id = v_user_id;

    SELECT count(*) INTO v_task_count
    FROM tasks WHERE user_id = v_user_id AND completed = true;

    IF v_task_count = 1 THEN
        INSERT INTO achievements (user_id, type)
        VALUES (v_user_id, 'first_task_completed')
        ON CONFLICT (user_id, type) DO NOTHING;
    END IF;

    IF v_task_count >= 50 THEN
        INSERT INTO achievements (user_id, type)
        VALUES (v_user_id, 'fifty_tasks_completed')
        ON CONFLICT (user_id, type) DO NOTHING;
    END IF;

    PERFORM check_perfect_day(v_user_id, CURRENT_DATE);
END;
$$;

-- complete_habit: verify ownership before awarding XP
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

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Habit not found';
    END IF;

    IF v_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

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

    INSERT INTO habit_completions (habit_id, user_id, completed_at, completed_at_ts)
    VALUES (p_habit_id, v_user_id, CURRENT_DATE, now())
    ON CONFLICT (habit_id, completed_at) DO NOTHING;

    UPDATE user_stats
    SET xp = xp + v_xp_reward,
        coins = coins + v_coins_reward,
        updated_at = now()
    WHERE id = v_user_id;

    IF v_streak >= 7 THEN
        INSERT INTO achievements (user_id, type)
        VALUES (v_user_id, 'seven_day_streak')
        ON CONFLICT (user_id, type) DO NOTHING;
    END IF;

    PERFORM check_perfect_day(v_user_id, CURRENT_DATE);
END;
$$;

-- 2.1b: Ensure UNIQUE constraint on habit_completions(habit_id, completed_at)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'habit_completions_habit_id_completed_at_key'
    ) THEN
        ALTER TABLE habit_completions
        ADD CONSTRAINT habit_completions_habit_id_completed_at_key
        UNIQUE (habit_id, completed_at);
    END IF;
END $$;

-- ============================================================
-- 2.2: SECURITY DEFINER helper for Group RLS
--      Drop only the SELECT policy on group_members (the one
--      that causes recursion) and recreate using the helper.
--      Leave INSERT/DELETE policies untouched.
-- ============================================================

-- Helper function: checks if the current user is a member of the given group
-- Uses SECURITY DEFINER to bypass RLS when checking membership
CREATE OR REPLACE FUNCTION is_group_member(check_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = check_group_id
        AND user_id = auth.uid()
    );
$$;

-- Drop the SELECT policy that can cause recursion and recreate it
DROP POLICY IF EXISTS "Members can view group members" ON group_members;
DROP POLICY IF EXISTS "Group members viewable by authenticated" ON group_members;

CREATE POLICY "Group members viewable by authenticated" ON group_members
    FOR SELECT USING (
        is_group_member(group_id)
        OR EXISTS (SELECT 1 FROM groups WHERE id = group_id AND owner_id = auth.uid())
    );

-- ============================================================
-- 2.3: Sanitize join_group invite codes
-- ============================================================

CREATE OR REPLACE FUNCTION join_group(p_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_group_id UUID;
    v_user_id UUID := auth.uid();
    v_clean_code TEXT;
BEGIN
    v_clean_code := upper(trim(p_invite_code));

    IF v_clean_code !~ '^[A-Z0-9]{8}$' THEN
        RAISE EXCEPTION 'Invalid invite code format. Code must be 8 alphanumeric characters.';
    END IF;

    INSERT INTO users (id, xp, coins)
    VALUES (v_user_id, 0, 0)
    ON CONFLICT (id) DO NOTHING;

    SELECT id INTO v_group_id FROM groups WHERE invite_code = v_clean_code;
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite code';
    END IF;

    INSERT INTO group_members (group_id, user_id)
    VALUES (v_group_id, v_user_id)
    ON CONFLICT (group_id, user_id) DO NOTHING;

    RETURN v_group_id;
END;
$$;