-- Distinct years that already have an athletic record or a sports achievement.
-- The Achievements page uses this so a saved year stays reachable.

CREATE OR REPLACE FUNCTION public.achievement_years()
RETURNS TABLE (year integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT sport_records.year
  FROM sport_records
  UNION
  SELECT DISTINCT sports_achievements.meet_year
  FROM sports_achievements;
$$;

REVOKE ALL ON FUNCTION public.achievement_years() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.achievement_years() TO authenticated;
