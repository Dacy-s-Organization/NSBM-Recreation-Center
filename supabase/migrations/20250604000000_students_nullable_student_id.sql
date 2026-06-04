-- Allow students without an external student ID (e.g. CSV rows missing that column)
ALTER TABLE students ALTER COLUMN student_id DROP NOT NULL;
