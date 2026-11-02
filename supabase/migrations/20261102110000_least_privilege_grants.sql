-- Least privilege. Row Level Security stays the authorization check.
-- anon and PUBLIC get no table rights. authenticated keeps read and write,
-- without TRUNCATE, REFERENCES, or TRIGGER.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

REVOKE ALL ON TABLE public.certificate_reference_counters FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.certificate_references FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.issued_certificates FROM authenticated;
GRANT SELECT ON TABLE public.certificate_references TO authenticated;
GRANT SELECT ON TABLE public.issued_certificates TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
