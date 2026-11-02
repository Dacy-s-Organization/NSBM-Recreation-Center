-- A typed reference number must not push the shared counter forward.

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
  LOOP
    IF n > 99999 THEN
      RAISE EXCEPTION 'Reference numbers are exhausted.';
    END IF;
    allocated := 'AA' || lpad(n::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM certificate_references WHERE reference_no = allocated);
    n := n + 1;
  END LOOP;
  UPDATE certificate_reference_counters SET next_value = n + 1 WHERE id = 1;
  IF TG_TABLE_NAME = 'sport_records' THEN
    INSERT INTO certificate_references (reference_no, sport_record_id) VALUES (allocated, NEW.id);
  ELSIF TG_TABLE_NAME = 'sports_achievements' THEN
    INSERT INTO certificate_references (reference_no, sports_achievement_id) VALUES (allocated, NEW.id);
  ELSIF TG_TABLE_NAME = 'inter_uni_records' THEN
    INSERT INTO certificate_references (reference_no, inter_uni_record_id) VALUES (allocated, NEW.id);
  ELSIF TG_TABLE_NAME = 'inter_uni_achievements' THEN
    INSERT INTO certificate_references (reference_no, inter_uni_achievement_id) VALUES (allocated, NEW.id);
  ELSE
    RAISE EXCEPTION 'No certificate reference column for table %.', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_reference_for_new_entry() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reset_certificate_counter()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  IF NOT public.is_super() THEN
    RAISE EXCEPTION 'Only the super user can reset the reference counter.';
  END IF;
  SELECT coalesce(max(substring(reference_no FROM 3)::int), 0) + 1
    INTO n
    FROM certificate_references
    WHERE reference_no ~ '^AA[0-9]{5}$';
  IF n > 100000 THEN
    n := 100000;
  END IF;
  UPDATE certificate_reference_counters SET next_value = n WHERE id = 1;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_certificate_counter() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_certificate_counter() TO authenticated;
