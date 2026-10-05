-- Team cards for Sports Fiesta and Inter University. NIC, batch, and degree
-- are never stored. Photos are reference images only.

CREATE TABLE team_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL CHECK (section IN ('sports-fiesta', 'inter-university')),
  event_name TEXT NOT NULL CHECK (length(trim(event_name)) > 0),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('docx', 'xlsx', 'csv', 'image')),
  source_file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_cards_section ON team_cards(section, created_at DESC);

CREATE TABLE team_card_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_card_id UUID NOT NULL REFERENCES team_cards(id) ON DELETE CASCADE,
  position INT NOT NULL CHECK (position >= 0),
  student_id TEXT NOT NULL CHECK (length(trim(student_id)) > 0),
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
  jersey_no TEXT CHECK (jersey_no IS NULL OR length(trim(jersey_no)) > 0),
  UNIQUE (team_card_id, student_id)
);

CREATE INDEX idx_team_card_members_card ON team_card_members(team_card_id, position);

CREATE TABLE team_card_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_card_id UUID NOT NULL REFERENCES team_cards(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  image_bytes BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_card_photos_size CHECK (octet_length(image_bytes) > 0 AND octet_length(image_bytes) <= 4194304),
  CONSTRAINT team_card_photos_type CHECK (
    content_type IN (
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'image/heif', 'image/heic', 'image/heif-sequence', 'image/heic-sequence'
    )
  )
);

CREATE INDEX idx_team_card_photos_card ON team_card_photos(team_card_id);

CREATE OR REPLACE FUNCTION public.enforce_team_card_photo_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT count(*) FROM team_card_photos WHERE team_card_id = NEW.team_card_id
  ) >= 10 THEN
    RAISE EXCEPTION 'A team card can have at most 10 photos.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER team_card_photos_limit
  BEFORE INSERT ON team_card_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_team_card_photo_limit();

CREATE OR REPLACE FUNCTION public.add_team_card_photo(
  p_card uuid,
  p_file_name text,
  p_content_type text,
  p_image_base64 text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  kind text;
  raw bytea;
  new_id uuid;
BEGIN
  IF p_card IS NULL OR NOT EXISTS (SELECT 1 FROM team_cards WHERE id = p_card) THEN
    RAISE EXCEPTION 'Team card was not found.';
  END IF;
  kind := lower(trim(coalesce(p_content_type, '')));
  IF kind NOT IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/heif', 'image/heic', 'image/heif-sequence', 'image/heic-sequence'
  ) THEN
    RAISE EXCEPTION 'Photo must be a jpeg, png, webp, gif, or heif image.';
  END IF;
  raw := decode(p_image_base64, 'base64');
  IF octet_length(raw) = 0 OR octet_length(raw) > 4194304 THEN
    RAISE EXCEPTION 'Each photo must be 4 MB or smaller.';
  END IF;
  INSERT INTO team_card_photos (team_card_id, file_name, content_type, image_bytes)
  VALUES (p_card, left(coalesce(nullif(trim(p_file_name), ''), 'photo'), 200), kind, raw)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_team_card_photo(p_id uuid)
RETURNS TABLE (file_name text, content_type text, image_base64 text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.file_name, p.content_type, encode(p.image_bytes, 'base64')
  FROM team_card_photos p
  WHERE p.id = p_id;
$$;

ALTER TABLE sports_achievements
  ADD COLUMN team_card_id UUID REFERENCES team_cards(id) ON DELETE SET NULL;

ALTER TABLE inter_uni_achievements
  ADD COLUMN team_card_id UUID REFERENCES team_cards(id) ON DELETE SET NULL;

CREATE INDEX idx_sports_achievements_team_card ON sports_achievements(team_card_id);
CREATE INDEX idx_inter_uni_achievements_team_card ON inter_uni_achievements(team_card_id);

CREATE OR REPLACE FUNCTION public.enforce_achievement_team_card_section()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  card_section text;
  expected text;
BEGIN
  IF NEW.team_card_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT section INTO card_section FROM team_cards WHERE id = NEW.team_card_id;
  IF card_section IS NULL THEN
    RAISE EXCEPTION 'Team card was not found.';
  END IF;
  expected := CASE TG_TABLE_NAME
    WHEN 'sports_achievements' THEN 'sports-fiesta'
    WHEN 'inter_uni_achievements' THEN 'inter-university'
    ELSE NULL
  END;
  IF card_section IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Team card belongs to a different section.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sports_achievements_team_card_section
  BEFORE INSERT OR UPDATE OF team_card_id ON sports_achievements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_achievement_team_card_section();

CREATE TRIGGER inter_uni_achievements_team_card_section
  BEFORE INSERT OR UPDATE OF team_card_id ON inter_uni_achievements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_achievement_team_card_section();

CREATE OR REPLACE FUNCTION public.enforce_team_card_section_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.section IS DISTINCT FROM OLD.section AND (
    EXISTS (SELECT 1 FROM sports_achievements WHERE team_card_id = NEW.id)
    OR EXISTS (SELECT 1 FROM inter_uni_achievements WHERE team_card_id = NEW.id)
  ) THEN
    RAISE EXCEPTION 'Cannot change the section of a team card that is linked to an achievement.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER team_cards_section_change
  BEFORE UPDATE OF section ON team_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_team_card_section_change();

ALTER TABLE team_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_card_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_card_photos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON team_cards FROM PUBLIC, anon;
REVOKE ALL ON team_card_members FROM PUBLIC, anon;
REVOKE ALL ON team_card_photos FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_card_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_card_photos TO authenticated;

CREATE POLICY "Authenticated read team_cards" ON team_cards
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super insert team_cards" ON team_cards
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super update team_cards" ON team_cards
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super delete team_cards" ON team_cards
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');

CREATE POLICY "Authenticated read team_card_members" ON team_card_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super insert team_card_members" ON team_card_members
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super update team_card_members" ON team_card_members
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super delete team_card_members" ON team_card_members
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');

CREATE POLICY "Authenticated read team_card_photos" ON team_card_photos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super insert team_card_photos" ON team_card_photos
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super update team_card_photos" ON team_card_photos
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super')
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');
CREATE POLICY "Super delete team_card_photos" ON team_card_photos
  FOR DELETE TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'super');

REVOKE ALL ON FUNCTION public.enforce_team_card_photo_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_achievement_team_card_section() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_team_card_section_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_team_card_photo(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_team_card_photo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_team_card_photo(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_card_photo(uuid) TO authenticated;
