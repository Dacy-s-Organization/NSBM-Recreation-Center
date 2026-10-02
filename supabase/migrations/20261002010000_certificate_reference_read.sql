-- Signed-in staff can read references and certificate files. Writes stay on the
-- super-only functions; these tables have no insert, update, or delete policies.

CREATE POLICY certificate_references_select
  ON certificate_references
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY issued_certificates_select
  ON issued_certificates
  FOR SELECT
  TO authenticated
  USING (true);
