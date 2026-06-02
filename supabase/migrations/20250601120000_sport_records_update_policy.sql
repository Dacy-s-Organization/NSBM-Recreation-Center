CREATE POLICY "Authenticated update sport_records"
  ON sport_records FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
