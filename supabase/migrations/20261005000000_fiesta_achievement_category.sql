-- Sports Fiesta achievements are either athletics (tied to an event in sport_tracks)
-- or other sports. Existing rows become 'other'.

ALTER TABLE sports_achievements
  ADD COLUMN category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('athletics', 'other')),
  ADD COLUMN track_id UUID REFERENCES sport_tracks(id) ON DELETE RESTRICT;

ALTER TABLE sports_achievements ADD CONSTRAINT sports_achievements_athletics_event
  CHECK ((category = 'athletics') = (track_id IS NOT NULL));

CREATE INDEX idx_sports_achievements_track ON sports_achievements(track_id);
