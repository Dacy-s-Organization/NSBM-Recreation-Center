-- Saved NSBM sports for the achievements dropdown.
-- sports_achievements.sport stays text so existing rows are unchanged.

CREATE TABLE sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sports_name_lower_key ON sports (lower(name));

ALTER TABLE sports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read sports"
  ON sports FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super insert sports"
  ON sports FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');

GRANT SELECT, INSERT ON sports TO authenticated;
GRANT ALL ON sports TO service_role;

INSERT INTO sports (name, sort_order) VALUES
  ('Swimming', 1),
  ('Athletics & Calisthenics', 2),
  ('Badminton', 3),
  ('Cricket', 4),
  ('Rugby', 5),
  ('Volleyball', 6),
  ('Netball', 7),
  ('Tennis', 8),
  ('Chess & Table Tennis', 9),
  ('Martial Arts', 10),
  ('Basketball & Archery', 11);
