-- Extend students with faculty, intake, degree programme, gender, contact info
ALTER TABLE students ADD COLUMN IF NOT EXISTS faculty TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS intake TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS degree_programme TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS nic TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX idx_students_faculty ON students(faculty);
CREATE INDEX idx_students_intake ON students(intake);
