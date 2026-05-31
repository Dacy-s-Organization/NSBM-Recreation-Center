-- Houses
CREATE TABLE houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

-- Students
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  house_id UUID NOT NULL REFERENCES houses(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_students_house_id ON students(house_id);

-- Sport tracks
CREATE TABLE sport_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL DEFAULT '',
  lower_is_better BOOLEAN NOT NULL DEFAULT false
);

-- Sport records
CREATE TABLE sport_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES sport_tracks(id) ON DELETE RESTRICT,
  year INT NOT NULL CHECK (year >= 1900 AND year <= 2100),
  value NUMERIC NOT NULL CHECK (value >= 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sport_records_year ON sport_records(year);
CREATE INDEX idx_sport_records_track_id ON sport_records(track_id);
CREATE INDEX idx_sport_records_student_id ON sport_records(student_id);

-- Inventory
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_inventory_items_name_lower ON inventory_items (lower(name));

-- Seed houses
INSERT INTO houses (name) VALUES
  ('Ruby Adventurers'),
  ('Citrine Warriors'),
  ('Emerald Fighters'),
  ('Sapphire Heroes');

-- Seed sport tracks
INSERT INTO sport_tracks (name, unit, lower_is_better) VALUES
  ('Long Jump', 'm', false),
  ('High Jump', 'm', false),
  ('100m Run', 's', true),
  ('200m Run', 's', true),
  ('400m Run', 's', true),
  ('Shot Put', 'm', false),
  ('Discus Throw', 'm', false),
  ('Javelin Throw', 'm', false);

-- RLS
ALTER TABLE houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sport_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sport_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read houses" ON houses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read students" ON students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert students" ON students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update students" ON students FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read sport_tracks" ON sport_tracks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert sport_tracks" ON sport_tracks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read sport_records" ON sport_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert sport_records" ON sport_records FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read inventory" ON inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert inventory" ON inventory_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update inventory" ON inventory_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
