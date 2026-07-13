-- Prevent duplicate athletic records for the same student/track/year.
-- Safe when no duplicates exist; if this fails, clean duplicates first.

CREATE UNIQUE INDEX IF NOT EXISTS sport_records_student_track_year_key
  ON sport_records (student_id, track_id, year);
