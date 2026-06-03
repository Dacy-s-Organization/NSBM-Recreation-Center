CREATE POLICY "Authenticated delete students"
  ON students FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated delete sport_records"
  ON sport_records FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated delete inventory"
  ON inventory_items FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated delete sports_achievements"
  ON sports_achievements FOR DELETE TO authenticated USING (true);
