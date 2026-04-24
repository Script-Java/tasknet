-- Add is_focus to todos
ALTER TABLE todos ADD COLUMN is_focus BOOLEAN DEFAULT false;
ALTER TABLE todos ADD COLUMN completed_at DATE;

-- Backfill for existing completed todos
UPDATE todos SET completed_at = CURRENT_DATE WHERE completed = true AND completed_at IS NULL;

-- Add streak and activity tracking to users
ALTER TABLE users ADD COLUMN current_streak_days INT DEFAULT 0;
ALTER TABLE users ADD COLUMN last_active_date DATE;

-- Add 7-day rolling history array to habits
ALTER TABLE habits ADD COLUMN completed_dates DATE[] DEFAULT '{}';

-- Create groups and group_members
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id UUID REFERENCES groups(id),
    user_id UUID REFERENCES users(id),
    joined_at TIMESTAMP DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

-- Lightweight XP log for weekly summaries
CREATE TABLE IF NOT EXISTS xp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    amount INT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

-- Drop functions with changed signatures
DROP FUNCTION IF EXISTS complete_todo(UUID);
DROP FUNCTION IF EXISTS complete_habit(UUID);
DROP FUNCTION IF EXISTS mark_overdue_todos(UUID);

-- Helper to track user activity and momentum
CREATE OR REPLACE FUNCTION update_user_activity(p_user_id UUID)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_last_active DATE;
    v_streak INT;
BEGIN
    SELECT last_active_date, current_streak_days INTO v_last_active, v_streak FROM users WHERE id = p_user_id;

    IF v_last_active = CURRENT_DATE THEN
        -- Already active today, streak remains the same
        RETURN v_streak;
    ELSIF v_last_active = CURRENT_DATE - INTERVAL '1 day' THEN
        -- Active yesterday, increment streak
        v_streak := v_streak + 1;
    ELSE
        -- Missed a day (or first time), reset to 1
        v_streak := 1;
    END IF;

    UPDATE users
    SET last_active_date = CURRENT_DATE,
        current_streak_days = v_streak
    WHERE id = p_user_id;

    RETURN v_streak;
END;
$$;

-- Recreate complete_todo with micro feedback and bonuses
CREATE OR REPLACE FUNCTION complete_todo(p_todo_id UUID)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
    v_completed BOOLEAN;
    v_is_focus BOOLEAN;
    v_todo_count INT;
    v_xp_reward INT := 10;
    v_coins_reward INT := 2;
    v_user_streak INT;
    v_multiplier DECIMAL := 1.0;
    v_base_xp INT;
BEGIN
    SELECT user_id, completed, is_focus INTO v_user_id, v_completed, v_is_focus
    FROM todos WHERE id = p_todo_id;

    IF v_completed THEN
        RETURN json_build_object('xp_gained', 0, 'coins_gained', 0, 'streak_updated', false);
    END IF;

    -- Update user activity and get streak
    v_user_streak := update_user_activity(v_user_id);

    -- Calculate Momentum Bonus
    IF v_user_streak >= 5 THEN
        v_multiplier := 1.2;
    ELSIF v_user_streak >= 3 THEN
        v_multiplier := 1.1;
    END IF;

    -- Apply Focus Bonus
    v_base_xp := v_xp_reward;
    IF v_is_focus THEN
        v_base_xp := v_base_xp + 10;
    END IF;

    v_xp_reward := ROUND(v_base_xp * v_multiplier);

    -- Mark completed
    UPDATE todos
    SET completed = true,
        completed_at = CURRENT_DATE
    WHERE id = p_todo_id;

    -- Update user and log XP
    UPDATE users SET xp = xp + v_xp_reward, coins = coins + v_coins_reward WHERE id = v_user_id;
    INSERT INTO xp_logs (user_id, amount) VALUES (v_user_id, v_xp_reward);

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

    RETURN json_build_object('xp_gained', v_xp_reward, 'coins_gained', v_coins_reward, 'streak_updated', false);
END;
$$;

-- Recreate complete_habit with micro feedback and bonuses
CREATE OR REPLACE FUNCTION complete_habit(p_habit_id UUID)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
    v_habit_streak INT;
    v_last_completed_date DATE;
    v_xp_reward INT := 15;
    v_coins_reward INT := 3;
    v_user_streak INT;
    v_multiplier DECIMAL := 1.0;
BEGIN
    SELECT user_id, streak, last_completed_date INTO v_user_id, v_habit_streak, v_last_completed_date
    FROM habits WHERE id = p_habit_id;

    IF v_last_completed_date = CURRENT_DATE THEN
        RETURN json_build_object('xp_gained', 0, 'coins_gained', 0, 'streak_updated', false);
    END IF;

    -- Update user activity and get momentum streak
    v_user_streak := update_user_activity(v_user_id);

    -- Habit specific streak
    IF v_last_completed_date = CURRENT_DATE - INTERVAL '1 day' THEN
        v_habit_streak := v_habit_streak + 1;
    ELSE
        v_habit_streak := 1;
    END IF;

    IF v_habit_streak > 3 THEN
        v_xp_reward := v_xp_reward + 5;
    END IF;

    -- Momentum Bonus
    IF v_user_streak >= 5 THEN
        v_multiplier := 1.2;
    ELSIF v_user_streak >= 3 THEN
        v_multiplier := 1.1;
    END IF;

    v_xp_reward := ROUND(v_xp_reward * v_multiplier);

    UPDATE habits
    SET streak = v_habit_streak,
        last_completed_date = CURRENT_DATE,
        -- Append today and keep only dates within last 7 days
        completed_dates = array(
            SELECT d FROM unnest(array_append(completed_dates, CURRENT_DATE)) d
            WHERE d >= CURRENT_DATE - INTERVAL '7 days'
        )
    WHERE id = p_habit_id;

    UPDATE users SET xp = xp + v_xp_reward, coins = coins + v_coins_reward WHERE id = v_user_id;
    INSERT INTO xp_logs (user_id, amount) VALUES (v_user_id, v_xp_reward);

    IF v_habit_streak = 7 THEN
        IF NOT EXISTS (SELECT 1 FROM achievements WHERE user_id = v_user_id AND type = '7-day habit streak') THEN
            INSERT INTO achievements (user_id, type) VALUES (v_user_id, '7-day habit streak');
        END IF;
    END IF;

    -- Check perfect day
    PERFORM check_perfect_day(v_user_id, CURRENT_DATE);

    RETURN json_build_object('xp_gained', v_xp_reward, 'coins_gained', v_coins_reward, 'streak_updated', true, 'new_streak', v_habit_streak);
END;
$$;

-- Consistency Score (7-day rolling)
CREATE OR REPLACE FUNCTION get_consistency_score(p_user_id UUID)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_habits INT;
    v_completed_habits INT;
    v_consistency INT;
BEGIN
    SELECT count(*) INTO v_total_habits FROM habits WHERE user_id = p_user_id;

    IF v_total_habits = 0 THEN
        RETURN 0;
    END IF;

    SELECT COALESCE(SUM(
        (SELECT count(*) FROM unnest(completed_dates) d WHERE d >= CURRENT_DATE - INTERVAL '7 days')
    ), 0) INTO v_completed_habits
    FROM habits WHERE user_id = p_user_id;

    v_consistency := (v_completed_habits * 100) / (v_total_habits * 7);
    RETURN LEAST(v_consistency, 100);
END;
$$;

-- Streak Risk Indicator
CREATE OR REPLACE FUNCTION get_streak_risk(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_result json;
BEGIN
    SELECT json_object_agg(id, true) INTO v_result
    FROM habits
    WHERE user_id = p_user_id
      AND streak > 0
      AND (last_completed_date IS NULL OR last_completed_date < CURRENT_DATE);

    RETURN COALESCE(v_result, '{}'::json);
END;
$$;

-- Weekly Summary
CREATE OR REPLACE FUNCTION get_weekly_summary(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_xp_gained INT := 0;
    v_todos_completed INT;
    v_habits_completed INT;
    v_highest_streak INT;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_xp_gained FROM xp_logs WHERE user_id = p_user_id AND created_at >= CURRENT_DATE - INTERVAL '7 days';
    SELECT count(*) INTO v_todos_completed FROM todos WHERE user_id = p_user_id AND completed = true AND completed_at >= CURRENT_DATE - INTERVAL '7 days';
    SELECT COALESCE(SUM((SELECT count(*) FROM unnest(completed_dates) d WHERE d >= CURRENT_DATE - INTERVAL '7 days')), 0) INTO v_habits_completed FROM habits WHERE user_id = p_user_id;
    SELECT COALESCE(MAX(streak), 0) INTO v_highest_streak FROM habits WHERE user_id = p_user_id;

    RETURN json_build_object(
        'xp_gained', v_xp_gained,
        'todos_completed', v_todos_completed,
        'habits_completed', v_habits_completed,
        'highest_streak', v_highest_streak
    );
END;
$$;

-- Group Leaderboard (Relative Ranking & Soft Social)
CREATE OR REPLACE FUNCTION get_group_leaderboard(p_group_id UUID, p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_ranking json;
    v_leaderboard json;
BEGIN
    -- Soft Social Activity
    WITH group_users AS (
        SELECT u.id, u.xp, u.last_active_date, gm.joined_at
        FROM users u
        JOIN group_members gm ON u.id = gm.user_id
        WHERE gm.group_id = p_group_id
    ),
    user_activity AS (
        SELECT gu.id, gu.xp, gu.last_active_date,
               ( (SELECT count(*) FROM todos WHERE user_id = gu.id AND completed = true AND completed_at = CURRENT_DATE) +
                 (SELECT count(*) FROM habits WHERE user_id = gu.id AND last_completed_date = CURRENT_DATE) ) as tasks_completed_today
        FROM group_users gu
    )
    SELECT COALESCE(json_agg(json_build_object(
        'user_id', id,
        'xp', xp,
        'tasks_completed_today', tasks_completed_today,
        'last_active_date', last_active_date
    ) ORDER BY xp DESC), '[]'::json) INTO v_leaderboard
    FROM user_activity;

    -- Relative Ranking
    WITH ranked_users AS (
        SELECT u.id, u.xp,
               RANK() OVER (ORDER BY u.xp DESC) as rank_pos,
               LAG(u.xp) OVER (ORDER BY u.xp DESC) as xp_above,
               LEAD(u.xp) OVER (ORDER BY u.xp DESC) as xp_below
        FROM users u
        JOIN group_members gm ON u.id = gm.user_id
        WHERE gm.group_id = p_group_id
    )
    SELECT COALESCE(json_build_object(
        'rank', rank_pos,
        'xp_difference_above', COALESCE(xp_above - xp, 0),
        'xp_difference_below', COALESCE(xp - xp_below, 0)
    ), '{}'::json) INTO v_ranking
    FROM ranked_users
    WHERE id = p_user_id;

    RETURN json_build_object(
        'ranking', COALESCE(v_ranking, '{}'::json),
        'leaderboard', COALESCE(v_leaderboard, '[]'::json)
    );
END;
$$;

-- Loss Feedback (Overdue Todos)
CREATE OR REPLACE FUNCTION mark_overdue_todos_with_feedback(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_overdue_count INT;
    v_xp_lost INT := 0;
    v_current_xp INT;
BEGIN
    SELECT xp INTO v_current_xp FROM users WHERE id = p_user_id;

    WITH updated AS (
        UPDATE todos
        SET overdue = true
        WHERE user_id = p_user_id
          AND due_date < CURRENT_DATE
          AND completed = false
          AND overdue = false
        RETURNING id
    )
    SELECT count(*) INTO v_overdue_count FROM updated;

    IF v_overdue_count > 0 THEN
        v_xp_lost := LEAST(v_current_xp, 5 * v_overdue_count);

        UPDATE users
        SET xp = GREATEST(0, xp - v_xp_lost)
        WHERE id = p_user_id;

        -- Optionally log negative XP? (Skipping for lightweight scope unless required)
    END IF;

    RETURN json_build_object(
        'missed_tasks_count', v_overdue_count,
        'xp_lost', v_xp_lost
    );
END;
$$;

-- Update get_user_progress to include Title
CREATE OR REPLACE FUNCTION get_user_progress(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_xp INT;
    v_level INT;
    v_next_level_xp INT;
    v_title TEXT;
BEGIN
    SELECT xp INTO v_xp FROM users WHERE id = p_user_id;
    IF v_xp IS NULL THEN
        RETURN json_build_object('xp', 0, 'level', 0, 'next_level_xp', 10, 'title', 'Beginner');
    END IF;

    v_level := floor(sqrt(v_xp / 10.0));
    v_next_level_xp := ((v_level + 1) * (v_level + 1)) * 10;

    IF v_level <= 3 THEN v_title := 'Beginner';
    ELSIF v_level <= 6 THEN v_title := 'Consistent';
    ELSIF v_level <= 10 THEN v_title := 'Operator';
    ELSE v_title := 'Elite';
    END IF;

    RETURN json_build_object(
        'xp', v_xp,
        'level', v_level,
        'next_level_xp', v_next_level_xp,
        'title', v_title
    );
END;
$$;
