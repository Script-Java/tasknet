-- ============================================================
-- TaskNet Gamification Layer
-- Extends existing tasks/habits tables, adds gamification
-- ============================================================

-- 1. user_stats (gamification profile, separate from auth.users)
CREATE TABLE IF NOT EXISTS user_stats (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    xp INT DEFAULT 0,
    coins INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add overdue column to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS overdue BOOLEAN DEFAULT false;

-- 3. Add streak tracking to habits
ALTER TABLE habits ADD COLUMN IF NOT EXISTS streak INT DEFAULT 0;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS last_completed_date DATE;

-- 4. habit_completions (one row per habit per day)
CREATE TABLE IF NOT EXISTS habit_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    completed_at DATE DEFAULT CURRENT_DATE,
    UNIQUE(habit_id, completed_at)
);

-- 5. achievements
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date ON habit_completions(user_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit ON habit_completions(habit_id);
CREATE INDEX IF NOT EXISTS idx_achievements_user_type ON achievements(user_id, type);
CREATE INDEX IF NOT EXISTS idx_tasks_user_overdue ON tasks(user_id) WHERE NOT completed AND NOT overdue;
CREATE INDEX IF NOT EXISTS idx_tasks_user_deadline ON tasks(user_id, (deadline::date));

-- RLS
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stats_owner" ON user_stats;
CREATE POLICY "stats_owner" ON user_stats FOR ALL USING (auth.uid() = id);
DROP POLICY IF EXISTS "completions_owner" ON habit_completions;
CREATE POLICY "completions_owner" ON habit_completions FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "achievements_owner" ON achievements;
CREATE POLICY "achievements_owner" ON achievements FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTION: ensure_user_stats
-- ============================================================
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

-- ============================================================
-- FUNCTION: complete_task
-- Marks task complete, awards +10 XP / +2 coins, checks achievements
-- ============================================================
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

    UPDATE tasks SET completed = true WHERE id = p_task_id;

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

-- ============================================================
-- FUNCTION: complete_habit
-- Completes habit for today, updates streak, awards XP/coins
-- +15 XP / +3 coins, +5 bonus XP if streak > 3
-- ============================================================
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

-- ============================================================
-- FUNCTION: mark_overdue_tasks
-- Marks tasks past deadline as overdue, -5 XP each (once)
-- ============================================================
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

-- ============================================================
-- FUNCTION: check_perfect_day
-- If all tasks and habits completed for the day: +20 XP, +10 coins
-- ============================================================
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

-- ============================================================
-- FUNCTION: get_daily_score
-- Returns { percentage: 0-100, grade: 'A'|'B'|'C'|'D' }
-- ============================================================
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

-- ============================================================
-- FUNCTION: get_user_progress
-- Returns { xp, level, next_level_xp }
-- level = floor(sqrt(xp / 10))
-- ============================================================
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

-- ============================================================
-- FUNCTION: get_user_stats
-- Returns full user stats: xp, coins, level, next_level_xp
-- ============================================================
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