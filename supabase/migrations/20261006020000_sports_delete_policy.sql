-- Super staff can remove names from the sport menu. Achievements store the sport as text,
-- so existing rows keep their sport name after it is removed from the list.
CREATE POLICY "Super staff can delete sports"
  ON sports FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');

GRANT DELETE ON sports TO authenticated;
