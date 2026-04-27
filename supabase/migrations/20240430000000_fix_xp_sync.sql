-- ============================================================
-- Fix: XP sync between user_stats and users tables
-- Gamification RPCs update user_stats.xp, but group queries
-- read from users.xp. This trigger keeps them in sync.
-- ============================================================

-- Trigger function: propagate user_stats changes to users table
CREATE OR REPLACE FUNCTION sync_user_stats_to_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE users
    SET xp = NEW.xp,
        coins = NEW.coins,
        updated_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$;

-- Apply the trigger: fires after every insert or update on user_stats
DROP TRIGGER IF EXISTS trg_sync_user_stats_to_users ON user_stats;
CREATE TRIGGER trg_sync_user_stats_to_users
    AFTER INSERT OR UPDATE OF xp, coins
    ON user_stats
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_stats_to_users();

-- Also sync existing data for users who already have XP in user_stats
-- but are still 0 in users
UPDATE users u
SET xp = s.xp,
    coins = s.coins,
    updated_at = now()
FROM user_stats s
WHERE u.id = s.id
  AND (u.xp != s.xp OR u.coins != s.coins);