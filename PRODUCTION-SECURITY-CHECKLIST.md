# Production security checklist

Apply these steps in order. The website and the Windows app keep working with the current database until the staff-only read migration. Do not start at the MFA migration.

Nothing in the repository deploy has been applied to the live Supabase project or to Netlify from this work. Docker was not running, so the new SQL was not executed on a local stack. Read each migration before applying it.

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

Have every super user sign in and complete the authenticator setup. A super account cannot open the app until that setup succeeds. `mic` users are not asked to enrol.

Only after that, apply `20261102140000_require_mfa_for_writes.sql`. From then on, a super session that has not completed the authenticator check cannot change data.

## 7. GitHub and the website

- Turn on secret scanning and push protection.
- Turn on branch protection for `main`.
- Deploy the website only after steps 1 to 4. Confirm the live responses send `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`, and that the login page still loads.

## 8. Windows app

The Release publish in `desktop/publish` was built with SDK 10.0.403 and embeds runtime 10.0.14. Rebuild and publish again after every later .NET 10 servicing release. The installer script is `desktop/installer/NSBM-Recreation-Center.iss`. The redistributable installers were not on this machine, so the setup exe was not rebuilt.

## Issues that stay open until you confirm

- Staff-only reads, after step 2.
- MFA enforcement, after step 6.
- The desktop runtime rebuild, after you install the published app.
