-- Create gamification tables
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY, -- references auth.users
    xp INT DEFAULT 0,
    coins INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    streak INT DEFAULT 0,
    last_completed_date DATE
);

CREATE TABLE IF NOT EXISTS todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    due_date DATE,
    completed BOOLEAN DEFAULT false,
    overdue BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type TEXT,
    unlocked_at TIMESTAMP DEFAULT now()
);

-- check_perfect_day(p_user_id UUID, p_date DATE)
CREATE OR REPLACE FUNCTION check_perfect_day(p_user_id UUID, p_date DATE)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_incomplete_todos INT;
    v_incomplete_habits INT;
    v_already_awarded INT;
BEGIN
    -- Check if there's any incomplete todo for today
    SELECT count(*) INTO v_incomplete_todos
    FROM todos
    WHERE user_id = p_user_id AND due_date = p_date AND completed = false;

    -- Check if there's any incomplete habit for today
    SELECT count(*) INTO v_incomplete_habits
    FROM habits
    WHERE user_id = p_user_id AND (last_completed_date IS NULL OR last_completed_date < p_date);

    IF v_incomplete_todos = 0 AND v_incomplete_habits = 0 THEN
        -- Verify not already awarded for this date (using achievements table)
        SELECT count(*) INTO v_already_awarded
        FROM achievements
        WHERE user_id = p_user_id AND type = 'Perfect Day: ' || p_date::text;

        IF v_already_awarded = 0 THEN
            INSERT INTO achievements (user_id, type) VALUES (p_user_id, 'Perfect Day: ' || p_date::text);
            UPDATE users SET xp = xp + 20, coins = coins + 10 WHERE id = p_user_id;
        END IF;
    END IF;
END;
$$;

-- complete_todo(p_todo_id UUID)
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

    -- Mark completed
    UPDATE todos SET completed = true WHERE id = p_todo_id;

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

-- complete_habit(p_habit_id UUID)
CREATE OR REPLACE FUNCTION complete_habit(p_habit_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
    v_streak INT;
    v_last_completed_date DATE;
    v_xp_reward INT := 15;
    v_coins_reward INT := 3;
BEGIN
    SELECT user_id, streak, last_completed_date INTO v_user_id, v_streak, v_last_completed_date
    FROM habits WHERE id = p_habit_id;

    IF v_last_completed_date = CURRENT_DATE THEN
        RETURN; -- Already completed today
    END IF;

    IF v_last_completed_date = CURRENT_DATE - INTERVAL '1 day' THEN
        v_streak := v_streak + 1;
    ELSE
        v_streak := 1;
    END IF;

    IF v_streak > 3 THEN
        v_xp_reward := v_xp_reward + 5;
    END IF;

    UPDATE habits
    SET streak = v_streak,
        last_completed_date = CURRENT_DATE
    WHERE id = p_habit_id;

    UPDATE users
    SET xp = xp + v_xp_reward,
        coins = coins + v_coins_reward
    WHERE id = v_user_id;

    IF v_streak = 7 THEN
        -- Only award once (could add unique constraint, but keeping it simple)
        IF NOT EXISTS (SELECT 1 FROM achievements WHERE user_id = v_user_id AND type = '7-day habit streak') THEN
            INSERT INTO achievements (user_id, type) VALUES (v_user_id, '7-day habit streak');
        END IF;
    END IF;

    -- Check perfect day
    PERFORM check_perfect_day(v_user_id, CURRENT_DATE);
END;
$$;

-- mark_overdue_todos(p_user_id UUID)
CREATE OR REPLACE FUNCTION mark_overdue_todos(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_overdue_count INT;
BEGIN
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
        UPDATE users
        SET xp = GREATEST(0, xp - (5 * v_overdue_count))
        WHERE id = p_user_id;
    END IF;
END;
$$;

-- get_daily_score(p_user_id UUID, p_date DATE)
CREATE OR REPLACE FUNCTION get_daily_score(p_user_id UUID, p_date DATE)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_todos INT;
    v_completed_todos INT;
    v_total_habits INT;
    v_completed_habits INT;
    v_total INT;
    v_completed INT;
    v_percentage INT;
    v_grade TEXT;
BEGIN
    SELECT count(*), count(*) FILTER (WHERE completed = true)
    INTO v_total_todos, v_completed_todos
    FROM todos
    WHERE user_id = p_user_id AND due_date = p_date;

    SELECT count(*), count(*) FILTER (WHERE last_completed_date = p_date)
    INTO v_total_habits, v_completed_habits
    FROM habits
    WHERE user_id = p_user_id;

    v_total := COALESCE(v_total_todos, 0) + COALESCE(v_total_habits, 0);
    v_completed := COALESCE(v_completed_todos, 0) + COALESCE(v_completed_habits, 0);

    IF v_total = 0 THEN
        v_percentage := 0;
    ELSE
        v_percentage := (v_completed * 100) / v_total;
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
    SELECT xp INTO v_xp FROM users WHERE id = p_user_id;
    IF v_xp IS NULL THEN
        RETURN json_build_object('xp', 0, 'level', 0, 'next_level_xp', 10);
    END IF;

    v_level := floor(sqrt(v_xp / 10.0));
    v_next_level_xp := ((v_level + 1) * (v_level + 1)) * 10;

    RETURN json_build_object('xp', v_xp, 'level', v_level, 'next_level_xp', v_next_level_xp);
END;
$$;
