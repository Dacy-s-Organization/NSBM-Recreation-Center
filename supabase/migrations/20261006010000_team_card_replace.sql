-- Replace a card's athletes in one step, and let signed-in staff fire the
-- row checks. Those checks still only succeed for a super user.

GRANT EXECUTE ON FUNCTION public.enforce_team_card_photo_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_achievement_team_card_section() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_team_card_section_change() TO authenticated;

CREATE OR REPLACE FUNCTION public.replace_team_card_members(
  p_card uuid,
  p_event_name text,
  p_members jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  member jsonb;
  pos int := 0;
  seen text[] := ARRAY[]::text[];
  sid text;
  athlete text;
  jersey text;
BEGIN
  IF p_card IS NULL OR NOT EXISTS (SELECT 1 FROM team_cards WHERE id = p_card) THEN
    RAISE EXCEPTION 'Team card was not found.';
  END IF;
  IF length(trim(coalesce(p_event_name, ''))) = 0 THEN
    RAISE EXCEPTION 'Event name is required.';
  END IF;
  IF jsonb_typeof(p_members) IS DISTINCT FROM 'array' OR jsonb_array_length(p_members) = 0 THEN
    RAISE EXCEPTION 'Add at least one athlete.';
  END IF;

  UPDATE team_cards SET event_name = trim(p_event_name) WHERE id = p_card;
  DELETE FROM team_card_members WHERE team_card_id = p_card;

  FOR member IN SELECT value FROM jsonb_array_elements(p_members)
  LOOP
    sid := trim(coalesce(member->>'student_id', ''));
    athlete := trim(regexp_replace(coalesce(member->>'full_name', ''), '\s+', ' ', 'g'));
    jersey := nullif(trim(coalesce(member->>'jersey_no', '')), '');
    IF sid = '' OR athlete = '' THEN
      RAISE EXCEPTION 'Every row needs a student ID and a name.';
    END IF;
    IF sid = ANY (seen) THEN
      RAISE EXCEPTION 'Student ID % is listed more than once.', sid;
    END IF;
    seen := array_append(seen, sid);
    INSERT INTO team_card_members (team_card_id, position, student_id, full_name, jersey_no)
    VALUES (p_card, pos, sid, athlete, jersey);
    pos := pos + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_team_card_members(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_team_card_members(uuid, text, jsonb) TO authenticated;
