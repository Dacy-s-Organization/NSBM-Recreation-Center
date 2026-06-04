CREATE POLICY "Authenticated update sport_tracks"
  ON sport_tracks FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated delete sport_tracks"
  ON sport_tracks FOR DELETE TO authenticated USING (true);
