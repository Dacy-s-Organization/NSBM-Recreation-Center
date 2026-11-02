-- Append-only record of who changed which row. Image bytes are not stored here.

CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor uuid,
  table_name text NOT NULL,
  operation text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_select ON public.audit_log
  FOR SELECT TO authenticated
  USING ((SELECT public.is_super()));

REVOKE ALL ON TABLE public.audit_log FROM anon, PUBLIC, authenticated;
GRANT SELECT ON TABLE public.audit_log TO authenticated;

CREATE OR REPLACE FUNCTION public.write_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    old_row := to_jsonb(OLD) - 'image_bytes';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    new_row := to_jsonb(NEW) - 'image_bytes';
  END IF;
  INSERT INTO public.audit_log (actor, table_name, operation, old_data, new_data)
  VALUES (auth.uid(), TG_TABLE_NAME, TG_OP, old_row, new_row);
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  name text;
  names text[] := ARRAY[
    'houses', 'students', 'sport_tracks', 'sport_records', 'inventory_items',
    'sports_achievements', 'sports_achievement_winners', 'sports',
    'certificate_references', 'issued_certificates',
    'inter_uni_records', 'inter_uni_achievements', 'inter_uni_achievement_winners',
    'team_cards', 'team_card_members', 'team_card_photos'
  ];
BEGIN
  FOREACH name IN ARRAY names
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row ON public.%I', name);
    EXECUTE format(
      'CREATE TRIGGER audit_row AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.write_audit()',
      name
    );
  END LOOP;
END $$;
