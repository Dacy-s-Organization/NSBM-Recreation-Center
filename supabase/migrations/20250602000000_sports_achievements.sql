-- Sports achievements (e.g. "2025 Basketball Champion Team")
CREATE TABLE sports_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meet_year INT NOT NULL CHECK (meet_year >= 1900 AND meet_year <= 2100),
  sport TEXT NOT NULL,
  achievement_type TEXT NOT NULL,
  team_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sports_achievements_year ON sports_achievements(meet_year);

-- Join table for winners (supports team rosters)
CREATE TABLE sports_achievement_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id UUID NOT NULL REFERENCES sports_achievements(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(achievement_id, student_id)
);

CREATE INDEX idx_saw_achievement ON sports_achievement_winners(achievement_id);
CREATE INDEX idx_saw_student ON sports_achievement_winners(student_id);

-- RLS
ALTER TABLE sports_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_achievement_winners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read sports_achievements"
  ON sports_achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert sports_achievements"
  ON sports_achievements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update sports_achievements"
  ON sports_achievements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read sports_achievement_winners"
  ON sports_achievement_winners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert sports_achievement_winners"
  ON sports_achievement_winners FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete sports_achievement_winners"
  ON sports_achievement_winners FOR DELETE TO authenticated USING (true);
