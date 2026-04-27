CREATE OR REPLACE FUNCTION get_user_achievements(p_user_id UUID)
RETURNS TABLE(type TEXT, unlocked_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT type, unlocked_at FROM achievements
  WHERE user_id = p_user_id
  ORDER BY unlocked_at DESC;
$$;
