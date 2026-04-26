-- ============================================================
-- Fix: Priority-based XP, Daily Score improvements, 
-- Group creation user-ensure, Achievement dedup adjustments
-- ============================================================

-- 1. Update complete_task to award XP based on task priority
-- Low = 5 XP / 1 coin, Medium = 10 XP / 2 coins, High = 15 XP / 3 coins
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

-- 2. Update get_daily_score to also count tasks created today 
-- (not just those with deadlines today)
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
    -- Count tasks with deadline today OR created today
    SELECT count(*),
           count(*) FILTER (WHERE completed = true)
    INTO v_total_tasks, v_completed_tasks
    FROM tasks
    WHERE user_id = p_user_id
      AND (
        (deadline IS NOT NULL AND (deadline AT TIME ZONE 'UTC')::date = p_date)
        OR (date = p_date)
        OR (created_at::date = p_date)
      );

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

-- 3. Update create_group to ensure user exists in users table
CREATE OR REPLACE FUNCTION create_group(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_group_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
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

-- 4. Update join_group to ensure user exists in users table
CREATE OR REPLACE FUNCTION join_group(p_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_group_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
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