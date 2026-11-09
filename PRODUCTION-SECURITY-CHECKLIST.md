# Production security checklist

Apply these steps in order. The website and the Windows app keep working with the current database until the staff-only read migration. Do not start at the MFA migration.

Netlify hosting is discontinued. Do not add it back. The staff-access, grants, certificate-counter, and audit-log SQL are already applied on the live Supabase project. Do not apply the MFA file until that step is requested.

## 1. Accounts

- In the Supabase dashboard, confirm email sign-up is off and anonymous sign-in is off.
- Review Authentication, Users. Remove any account you do not recognise.
- Set `app_metadata.role` to `mic` on every legitimate staff account before the next step. A user with no role will see no rows after the staff-only read migration.

## 2. Database

Apply these files from `supabase/migrations/`, in this order, and stop before the MFA file:

1. `20261102100000_staff_role_checks.sql`
2. `20261102110000_least_privilege_grants.sql`
3. `20261102120000_certificate_counter_fix.sql`
4. `20261102130000_audit_log.sql`

Do not apply `20261102140000_require_mfa_for_writes.sql` yet.

After the first file, sign in as `mic` and confirm lists still load, then sign in as `super` and confirm one save still works. If every list is empty, the role was not set on that account, or the session claim does not match `auth.sessions`.

## 3. Edge function

Deploy `supabase/functions/create-staff-user`. New passwords must be at least 12 characters and include an uppercase letter, a lowercase letter, and a number. The function accepts the production site and `http://localhost:3000` only.

## 4. Auth settings

- Set the password policy to at least 12 characters.
- Turn on leaked-password protection.
- Turn on TOTP MFA.
- Set the access-token expiry to 15 minutes.
- Write down the Auth rate limits that are already configured. Do not loosen them.

## 5. Super accounts

Give each admin a separate super account. Assign `super` by user id in the dashboard. Do not put an email address in a migration.

## 6. Enrol, then require MFA for writes

Have every super user sign in and complete the authenticator setup. On the production site and in a Release desktop build, a super account cannot open the app until that setup succeeds. `mic` users are not asked to enrol. A development server and a Debug desktop build let every staff account continue without an authenticator. A verified factor still asks for the code.

Only after that, apply `20261102140000_require_mfa_for_writes.sql`. From then on, a super session that has not completed the authenticator check cannot change data.

## 7. GitHub and the website

- Turn on secret scanning and push protection.
- Turn on branch protection for `main`.
- Netlify hosting is discontinued. Do not deploy this project there. The website runs locally, and the Windows app is the staff client. Security headers stay in `middleware.ts`, and `next.config.ts` turns off `X-Powered-By`.

## 8. Windows app

The Release publish in `desktop/publish` was built with SDK 10.0.403 and embeds runtime 10.0.14. Rebuild and publish again after every later .NET 10 servicing release. The installer script is `desktop/installer/NSBM-Recreation-Center.iss`. The redistributable installers were not on this machine, so the setup exe was not rebuilt.

## Issues that stay open until you confirm

- Production super login still requires the authenticator. The database file that would block every authenticator-less super save stays unapplied so local development can continue.
- The desktop install on a staff PC can be confirmed later. The published exe already contains runtime 10.0.14.
