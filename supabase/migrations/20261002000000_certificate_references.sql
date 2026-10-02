-- One AA00001-style reference for every athletic record and sports achievement,
-- plus the certificate images issued for that entry.

CREATE TABLE certificate_reference_counters (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  next_value INT NOT NULL DEFAULT 1 CHECK (next_value >= 1 AND next_value <= 100000)
);

INSERT INTO certificate_reference_counters (id, next_value) VALUES (1, 1);

CREATE TABLE certificate_references (
  reference_no TEXT PRIMARY KEY CHECK (reference_no ~ '^AA[0-9]{5}$'),
  sport_record_id UUID UNIQUE REFERENCES sport_records(id) ON DELETE CASCADE,
  sports_achievement_id UUID UNIQUE REFERENCES sports_achievements(id) ON DELETE CASCADE,
  CONSTRAINT certificate_references_one_parent CHECK (
    (sport_record_id IS NOT NULL AND sports_achievement_id IS NULL)
    OR (sport_record_id IS NULL AND sports_achievement_id IS NOT NULL)
  )
);

CREATE TABLE issued_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no TEXT NOT NULL REFERENCES certificate_references(reference_no) ON UPDATE CASCADE ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  image_bytes BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT issued_certificates_size CHECK (octet_length(image_bytes) > 0 AND octet_length(image_bytes) <= 4194304),
  CONSTRAINT issued_certificates_type CHECK (
    content_type IN (
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'image/heif', 'image/heic', 'image/heif-sequence', 'image/heic-sequence'
    )
  )
);

CREATE INDEX idx_issued_certificates_reference ON issued_certificates(reference_no);

ALTER TABLE sports_achievement_winners
  ADD COLUMN place TEXT;

ALTER TABLE sports_achievement_winners
  ADD CONSTRAINT sports_achievement_winners_place_check
  CHECK (place IS NULL OR place IN ('1st', '2nd', '3rd'));

ALTER TABLE certificate_reference_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE issued_certificates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON certificate_reference_counters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON certificate_references FROM PUBLIC, anon, authenticated;
REVOKE ALL ON issued_certificates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON certificate_references TO authenticated;
GRANT SELECT ON issued_certificates TO authenticated;

-- Number entries that already exist, athletic records first, then achievements.
DO $$
DECLARE
  rec record;
  n int := 0;
BEGIN
  FOR rec IN SELECT id FROM sport_records ORDER BY recorded_at, id LOOP
    n := n + 1;
    INSERT INTO certificate_references (reference_no, sport_record_id)
    VALUES ('AA' || lpad(n::text, 5, '0'), rec.id);
  END LOOP;
  FOR rec IN SELECT id FROM sports_achievements ORDER BY created_at, id LOOP
    n := n + 1;
    INSERT INTO certificate_references (reference_no, sports_achievement_id)
    VALUES ('AA' || lpad(n::text, 5, '0'), rec.id);
  END LOOP;
  UPDATE certificate_reference_counters SET next_value = n + 1 WHERE id = 1;
END $$;

CREATE OR REPLACE FUNCTION public.assign_reference_for_new_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  allocated text;
BEGIN
  PERFORM 1 FROM certificate_reference_counters WHERE id = 1 FOR UPDATE;
  SELECT next_value INTO n FROM certificate_reference_counters WHERE id = 1;
  IF n > 99999 THEN
    RAISE EXCEPTION 'Reference numbers are exhausted.';
  END IF;
  allocated := 'AA' || lpad(n::text, 5, '0');
  UPDATE certificate_reference_counters SET next_value = n + 1 WHERE id = 1;
  IF TG_TABLE_NAME = 'sport_records' THEN
    INSERT INTO certificate_references (reference_no, sport_record_id)
    VALUES (allocated, NEW.id);
  ELSE
    INSERT INTO certificate_references (reference_no, sports_achievement_id)
    VALUES (allocated, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sport_records_assign_reference
  AFTER INSERT ON sport_records
  FOR EACH ROW EXECUTE FUNCTION public.assign_reference_for_new_entry();

CREATE TRIGGER sports_achievements_assign_reference
  AFTER INSERT ON sports_achievements
  FOR EACH ROW EXECUTE FUNCTION public.assign_reference_for_new_entry();

CREATE OR REPLACE FUNCTION public.rename_certificate_reference(p_old text, p_new text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested text;
  n int;
BEGIN
  IF (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'super' THEN
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
  n := substring(requested from 3)::int;
  UPDATE certificate_reference_counters
    SET next_value = greatest(next_value, n + 1)
    WHERE id = 1;
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
  IF (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'super' THEN
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
  VALUES (ref, left(coalesce(nullif(trim(p_file_name), ''), 'certificate'), 200), kind, raw)
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
  IF (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'super' THEN
    RAISE EXCEPTION 'Only the super user can remove a certificate.';
  END IF;
  DELETE FROM issued_certificates WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_issued_certificate(p_id uuid)
RETURNS TABLE (file_name text, content_type text, image_base64 text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT ic.file_name, ic.content_type, encode(ic.image_bytes, 'base64')
  FROM issued_certificates ic
  WHERE ic.id = p_id;
$$;

REVOKE ALL ON FUNCTION public.assign_reference_for_new_entry() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rename_certificate_reference(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attach_issued_certificate(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_issued_certificate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_issued_certificate(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rename_certificate_reference(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_issued_certificate(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_issued_certificate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_issued_certificate(uuid) TO authenticated;
