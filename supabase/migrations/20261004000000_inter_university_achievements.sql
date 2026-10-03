-- Inter University athletic records and achievements. The existing sport_records,
-- sports_achievements, and sports_achievement_winners tables hold Sports Fiesta data.

CREATE TABLE inter_uni_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES sport_tracks(id) ON DELETE RESTRICT,
  year INT NOT NULL CHECK (year >= 1900 AND year <= 2100),
  value NUMERIC NOT NULL CHECK (value >= 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inter_uni_records_year ON inter_uni_records(year);
CREATE INDEX idx_inter_uni_records_track_id ON inter_uni_records(track_id);
CREATE INDEX idx_inter_uni_records_student_id ON inter_uni_records(student_id);
CREATE UNIQUE INDEX inter_uni_records_student_track_year_key
  ON inter_uni_records (student_id, track_id, year);

CREATE TABLE inter_uni_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meet_year INT NOT NULL CHECK (meet_year >= 1900 AND meet_year <= 2100),
  sport TEXT NOT NULL,
  achievement_type TEXT NOT NULL,
  team_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inter_uni_achievements_year ON inter_uni_achievements(meet_year);

CREATE TABLE inter_uni_achievement_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id UUID NOT NULL REFERENCES inter_uni_achievements(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  place TEXT CHECK (place IS NULL OR place IN ('1st', '2nd', '3rd')),
  UNIQUE(achievement_id, student_id)
);

CREATE INDEX idx_iuaw_achievement ON inter_uni_achievement_winners(achievement_id);
CREATE INDEX idx_iuaw_student ON inter_uni_achievement_winners(student_id);

ALTER TABLE inter_uni_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE inter_uni_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inter_uni_achievement_winners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read inter_uni_records" ON inter_uni_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super insert inter_uni_records" ON inter_uni_records
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super update inter_uni_records" ON inter_uni_records
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super delete inter_uni_records" ON inter_uni_records
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');

CREATE POLICY "Authenticated read inter_uni_achievements" ON inter_uni_achievements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super insert inter_uni_achievements" ON inter_uni_achievements
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super update inter_uni_achievements" ON inter_uni_achievements
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super delete inter_uni_achievements" ON inter_uni_achievements
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');

CREATE POLICY "Authenticated read inter_uni_achievement_winners" ON inter_uni_achievement_winners
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super insert inter_uni_achievement_winners" ON inter_uni_achievement_winners
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super delete inter_uni_achievement_winners" ON inter_uni_achievement_winners
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');

ALTER TABLE certificate_references
  ADD COLUMN inter_uni_record_id UUID UNIQUE REFERENCES inter_uni_records(id) ON DELETE CASCADE,
  ADD COLUMN inter_uni_achievement_id UUID UNIQUE REFERENCES inter_uni_achievements(id) ON DELETE CASCADE;

ALTER TABLE certificate_references DROP CONSTRAINT certificate_references_one_parent;
ALTER TABLE certificate_references ADD CONSTRAINT certificate_references_one_parent CHECK (
  num_nonnulls(sport_record_id, sports_achievement_id, inter_uni_record_id, inter_uni_achievement_id) = 1
);

CREATE OR REPLACE FUNCTION public.assign_reference_for_new_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  allocated text;
BEGIN
  PERFORM 1 FROM certificate_reference_counters WHERE id = 1 FOR UPDATE;
  SELECT next_value INTO n FROM certificate_reference_counters WHERE id = 1;
  IF n > 99999 THEN
    RAISE EXCEPTION 'Reference numbers are exhausted.';
  END IF;
  allocated := 'AA' || lpad(n::text, 5, '0');
  UPDATE certificate_reference_counters SET next_value = n + 1 WHERE id = 1;
  IF TG_TABLE_NAME = 'sport_records' THEN
    INSERT INTO certificate_references (reference_no, sport_record_id) VALUES (allocated, NEW.id);
  ELSIF TG_TABLE_NAME = 'sports_achievements' THEN
    INSERT INTO certificate_references (reference_no, sports_achievement_id) VALUES (allocated, NEW.id);
  ELSIF TG_TABLE_NAME = 'inter_uni_records' THEN
    INSERT INTO certificate_references (reference_no, inter_uni_record_id) VALUES (allocated, NEW.id);
  ELSIF TG_TABLE_NAME = 'inter_uni_achievements' THEN
    INSERT INTO certificate_references (reference_no, inter_uni_achievement_id) VALUES (allocated, NEW.id);
  ELSE
    RAISE EXCEPTION 'No certificate reference column for table %.', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_reference_for_new_entry() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER inter_uni_records_assign_reference
  AFTER INSERT ON inter_uni_records
  FOR EACH ROW EXECUTE FUNCTION public.assign_reference_for_new_entry();

CREATE TRIGGER inter_uni_achievements_assign_reference
  AFTER INSERT ON inter_uni_achievements
  FOR EACH ROW EXECUTE FUNCTION public.assign_reference_for_new_entry();

CREATE OR REPLACE FUNCTION public.inter_uni_achievement_years()
RETURNS TABLE (year integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT inter_uni_records.year
  FROM inter_uni_records
  UNION
  SELECT DISTINCT inter_uni_achievements.meet_year
  FROM inter_uni_achievements;
$$;

REVOKE ALL ON FUNCTION public.inter_uni_achievement_years() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inter_uni_achievement_years() TO authenticated;
