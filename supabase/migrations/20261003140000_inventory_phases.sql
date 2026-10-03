-- Split inventory into Phase 01 / Phase 02 and Rec / Gym.
-- Existing rows stay in Phase 01 Rec Inventory.

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'phase_01',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'rec';

ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_phase_check;
ALTER TABLE inventory_items
  ADD CONSTRAINT inventory_items_phase_check
  CHECK (phase IN ('phase_01', 'phase_02'));

ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_category_check;
ALTER TABLE inventory_items
  ADD CONSTRAINT inventory_items_category_check
  CHECK (category IN ('rec', 'gym'));

DROP INDEX IF EXISTS idx_inventory_items_name_lower;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_phase_category_name
  ON inventory_items (phase, category, lower(name));
