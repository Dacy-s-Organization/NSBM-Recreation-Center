-- Only app_metadata.role = super may insert, update, or delete.
-- The existing super user keeps the same email and password.

UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'super')
WHERE email = 'nsbmrec@gmail.com';

DROP POLICY IF EXISTS "Authenticated insert students" ON students;
DROP POLICY IF EXISTS "Authenticated update students" ON students;
DROP POLICY IF EXISTS "Authenticated delete students" ON students;

DROP POLICY IF EXISTS "Authenticated insert sport_tracks" ON sport_tracks;
DROP POLICY IF EXISTS "Authenticated update sport_tracks" ON sport_tracks;
DROP POLICY IF EXISTS "Authenticated delete sport_tracks" ON sport_tracks;

DROP POLICY IF EXISTS "Authenticated insert sport_records" ON sport_records;
DROP POLICY IF EXISTS "Authenticated update sport_records" ON sport_records;
DROP POLICY IF EXISTS "Authenticated delete sport_records" ON sport_records;

DROP POLICY IF EXISTS "Authenticated insert inventory" ON inventory_items;
DROP POLICY IF EXISTS "Authenticated update inventory" ON inventory_items;
DROP POLICY IF EXISTS "Authenticated delete inventory" ON inventory_items;

DROP POLICY IF EXISTS "Authenticated insert sports_achievements" ON sports_achievements;
DROP POLICY IF EXISTS "Authenticated update sports_achievements" ON sports_achievements;
DROP POLICY IF EXISTS "Authenticated delete sports_achievements" ON sports_achievements;

DROP POLICY IF EXISTS "Authenticated insert sports_achievement_winners" ON sports_achievement_winners;
DROP POLICY IF EXISTS "Authenticated delete sports_achievement_winners" ON sports_achievement_winners;

CREATE POLICY "Super insert students" ON students
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super update students" ON students
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super delete students" ON students
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');

CREATE POLICY "Super insert sport_tracks" ON sport_tracks
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super update sport_tracks" ON sport_tracks
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super delete sport_tracks" ON sport_tracks
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');

CREATE POLICY "Super insert sport_records" ON sport_records
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super update sport_records" ON sport_records
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super delete sport_records" ON sport_records
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');

CREATE POLICY "Super insert inventory" ON inventory_items
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super update inventory" ON inventory_items
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super delete inventory" ON inventory_items
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');

CREATE POLICY "Super insert sports_achievements" ON sports_achievements
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super update sports_achievements" ON sports_achievements
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super delete sports_achievements" ON sports_achievements
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');

CREATE POLICY "Super insert sports_achievement_winners" ON sports_achievement_winners
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super delete sports_achievement_winners" ON sports_achievement_winners
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
