-- ============================================================
-- Badge Progress Tracking & Enhanced Gamification
-- ============================================================

-- 1. Badge progress table (client-side evaluator state)
CREATE TABLE IF NOT EXISTS user_badge_progress (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    progress JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_badge_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "badge_progress_owner" ON user_badge_progress;
CREATE POLICY "badge_progress_owner" ON user_badge_progress FOR ALL USING (auth.uid() = user_id);

-- 2. Add timestamp to habit_completions for time-based badges
ALTER TABLE habit_completions ADD COLUMN IF NOT EXISTS completed_at_ts TIMESTAMPTZ DEFAULT now();

-- 3. Deduplicate existing achievements before adding unique constraint
DELETE FROM achievements a
USING achievements b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.type = b.type;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'achievements_user_type_unique'
  ) THEN
    ALTER TABLE achievements ADD CONSTRAINT achievements_user_type_unique UNIQUE (user_id, type);
  END IF;
END$$;

-- 4. Update complete_habit to store timestamp
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

    INSERT INTO habit_completions (habit_id, user_id, completed_at, completed_at_ts)
    VALUES (p_habit_id, v_user_id, CURRENT_DATE, now())
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

-- 5. RPC: check_accountability_partner
-- Returns true if the user and at least one group member both completed
-- all their daily habits for the last 7 consecutive days.
CREATE OR REPLACE FUNCTION check_accountability_partner(p_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_group_id UUID;
    v_friend_id UUID;
    v_user_habit_count INT;
    v_friend_habit_count INT;
    v_match_days INT;
    v_day DATE;
BEGIN
    -- Find a group the user belongs to
    SELECT group_id INTO v_group_id
    FROM group_members
    WHERE user_id = p_user_id
    LIMIT 1;

    IF v_group_id IS NULL THEN
        RETURN false;
    END IF;

    -- Count user's daily habits
    SELECT count(*) INTO v_user_habit_count
    FROM habits
    WHERE user_id = p_user_id AND frequency = 'daily';

    IF v_user_habit_count = 0 THEN
        RETURN false;
    END IF;

    -- Iterate over other group members
    FOR v_friend_id IN
        SELECT user_id FROM group_members
        WHERE group_id = v_group_id AND user_id <> p_user_id
    LOOP
        SELECT count(*) INTO v_friend_habit_count
        FROM habits
        WHERE user_id = v_friend_id AND frequency = 'daily';

        IF v_friend_habit_count = 0 THEN
            CONTINUE;
        END IF;

        v_match_days := 0;
        FOR i IN 0..6 LOOP
            v_day := CURRENT_DATE - i;
            IF (
                (SELECT count(*) FROM habit_completions hc
                 JOIN habits h ON h.id = hc.habit_id
                 WHERE h.user_id = p_user_id AND h.frequency = 'daily'
                   AND hc.completed_at = v_day) = v_user_habit_count
                AND
                (SELECT count(*) FROM habit_completions hc
                 JOIN habits h ON h.id = hc.habit_id
                 WHERE h.user_id = v_friend_id AND h.frequency = 'daily'
                   AND hc.completed_at = v_day) = v_friend_habit_count
            ) THEN
                v_match_days := v_match_days + 1;
            ELSE
                EXIT;
            END IF;
        END LOOP;

        IF v_match_days = 7 THEN
            RETURN true;
        END IF;
    END LOOP;

    RETURN false;
END;
$$;
