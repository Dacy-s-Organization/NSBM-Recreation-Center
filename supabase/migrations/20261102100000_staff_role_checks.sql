-- Staff checks read the current role and the current session, not a stale token claim.
-- Assign roles by user id outside versioned migrations.

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users AS u
    JOIN auth.sessions AS s ON s.user_id = u.id
    WHERE u.id = auth.uid()
      AND s.id::text = auth.jwt() ->> 'session_id'
      AND coalesce(u.raw_app_meta_data ->> 'role', '') IN ('super', 'mic')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users AS u
    JOIN auth.sessions AS s ON s.user_id = u.id
    WHERE u.id = auth.uid()
      AND s.id::text = auth.jwt() ->> 'session_id'
      AND u.raw_app_meta_data ->> 'role' = 'super'
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super() TO authenticated;

CREATE OR REPLACE FUNCTION public.safe_file_name(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT left(
    coalesce(
      nullif(trim(both ' .' FROM regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9._ -]', '', 'g')), ''),
      'file'
    ),
    200
  );
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

DO $$
DECLARE
  read_only text[] := ARRAY['houses', 'certificate_references', 'issued_certificates'];
  no_update text[] := ARRAY['sports', 'sports_achievement_winners', 'inter_uni_achievement_winners'];
  full_write text[] := ARRAY[
    'students', 'sport_tracks', 'sport_records', 'inventory_items', 'sports_achievements',
    'inter_uni_records', 'inter_uni_achievements', 'team_cards', 'team_card_members', 'team_card_photos'
  ];
  name text;
BEGIN
  FOREACH name IN ARRAY read_only || no_update || full_write
  LOOP
    EXECUTE format(
      'CREATE POLICY staff_select ON public.%I FOR SELECT TO authenticated USING ((SELECT public.is_staff()))',
      name
    );
  END LOOP;

  FOREACH name IN ARRAY no_update || full_write
  LOOP
    EXECUTE format(
      'CREATE POLICY super_insert ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_super()))',
      name
    );
    EXECUTE format(
      'CREATE POLICY super_delete ON public.%I FOR DELETE TO authenticated USING ((SELECT public.is_super()))',
      name
    );
  END LOOP;

  FOREACH name IN ARRAY full_write
  LOOP
    EXECUTE format(
      'CREATE POLICY super_update ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.is_super())) WITH CHECK ((SELECT public.is_super()))',
      name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.rename_certificate_reference(p_old text, p_new text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested text;
BEGIN
  IF NOT public.is_super() THEN
    RAISE EXCEPTION 'Only the super user can change a reference number.';
  END IF;
  requested := upper(trim(coalesce(p_new, '')));
  IF requested !~ '^AA[0-9]{5}$' THEN
    RAISE EXCEPTION 'Reference number must look like AA00001.';
  END IF;
  IF requested = upper(trim(coalesce(p_old, ''))) THEN
    RETURN requested;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM certificate_references WHERE reference_no = upper(trim(p_old))) THEN
    RAISE EXCEPTION 'Reference number % was not found.', p_old;
  END IF;
  IF EXISTS (SELECT 1 FROM certificate_references WHERE reference_no = requested) THEN
    RAISE EXCEPTION 'Reference number % is already used.', requested;
  END IF;
  UPDATE certificate_references SET reference_no = requested WHERE reference_no = upper(trim(p_old));
  RETURN requested;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_issued_certificate(
  p_reference text,
  p_file_name text,
  p_content_type text,
  p_image_base64 text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref text;
  kind text;
  raw bytea;
  new_id uuid;
BEGIN
  IF NOT public.is_super() THEN
    RAISE EXCEPTION 'Only the super user can attach a certificate.';
  END IF;
  ref := upper(trim(coalesce(p_reference, '')));
  IF NOT EXISTS (SELECT 1 FROM certificate_references WHERE reference_no = ref) THEN
    RAISE EXCEPTION 'Reference number % was not found.', ref;
  END IF;
  kind := lower(trim(coalesce(p_content_type, '')));
  IF kind NOT IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/heif', 'image/heic', 'image/heif-sequence', 'image/heic-sequence'
  ) THEN
    RAISE EXCEPTION 'Certificate must be a jpeg, png, webp, gif, or heif image.';
  END IF;
  raw := decode(p_image_base64, 'base64');
  IF octet_length(raw) > 4194304 THEN
    RAISE EXCEPTION 'Each certificate image must be 4 MB or smaller.';
  END IF;
  INSERT INTO issued_certificates (reference_no, file_name, content_type, image_bytes)
  VALUES (ref, public.safe_file_name(p_file_name), kind, raw)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_issued_certificate(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super() THEN
    RAISE EXCEPTION 'Only the super user can remove a certificate.';
  END IF;
  DELETE FROM issued_certificates WHERE id = p_id;
END;
$$;

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
  VALUES (p_card, public.safe_file_name(p_file_name), kind, raw)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
