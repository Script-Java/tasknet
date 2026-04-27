-- ============================================================
-- Fix: Stricter daily grade + only count daily-frequency habits
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
    -- Count tasks: deadline on/before today (includes overdue), OR dated today, OR created today
    SELECT count(*),
           count(*) FILTER (WHERE completed = true)
    INTO v_total_tasks, v_completed_tasks
    FROM tasks
    WHERE user_id = p_user_id
      AND (
        (deadline IS NOT NULL AND (deadline AT TIME ZONE 'UTC')::date <= p_date)
        OR (date = p_date)
        OR (created_at::date = p_date)
      );

    -- Only count DAILY-frequency habits (weekly ones shouldn't penalise every day)
    SELECT count(*) INTO v_total_habits
    FROM habits WHERE user_id = p_user_id AND frequency = 'daily';

    SELECT count(*) INTO v_completed_habits
    FROM habit_completions hc
    JOIN habits h ON h.id = hc.habit_id
    WHERE h.user_id = p_user_id
      AND h.frequency = 'daily'
      AND hc.completed_at = p_date;

    v_total := COALESCE(v_total_tasks, 0) + COALESCE(v_total_habits, 0);
    v_completed := COALESCE(v_completed_tasks, 0) + COALESCE(v_completed_habits, 0);

    IF v_total = 0 THEN
        v_percentage := 0;
    ELSE
        v_percentage := LEAST(100, (v_completed * 100) / v_total);
    END IF;

    -- Stricter grading: A requires everything done
    IF v_percentage = 100 THEN v_grade := 'A';
    ELSIF v_percentage >= 85 THEN v_grade := 'B';
    ELSIF v_percentage >= 65 THEN v_grade := 'C';
    ELSIF v_percentage >= 40 THEN v_grade := 'D';
    ELSE v_grade := 'F';
    END IF;

    RETURN json_build_object('percentage', v_percentage, 'grade', v_grade);
END;
$$;