-- Align students table with NSBM Foundation CSV export
ALTER TABLE students ADD COLUMN IF NOT EXISTS serial_no INT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS university TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS title TEXT;

ALTER TABLE students ALTER COLUMN house_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_serial_no ON students(serial_no);
