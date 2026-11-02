-- Apply this only after every super account has enrolled a TOTP factor.
-- Until then, a super write would be rejected because the session is still aal1.

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
      AND auth.jwt() ->> 'aal' = 'aal2'
  );
$$;
