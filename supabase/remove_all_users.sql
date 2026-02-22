-- =============================================================================
-- LOGOS: Remove ALL users (run in Supabase Dashboard → SQL Editor)
-- Use this to reset auth and test signup/login from scratch.
--
-- Before testing in the app, ensure in Supabase Dashboard:
--   Authentication → URL Configuration: Site URL = your app URL (e.g. https://yoursite.netlify.app)
--   Authentication → Providers → Email: "Allow new users to sign up" = ON
--   Authentication → Providers → Email: "Confirm email" = ON recommended (app supports resend + redirect)
-- =============================================================================

-- 1. Delete all auth sessions (required before deleting users in some setups)
DELETE FROM auth.sessions;

-- 2. Delete all users (profiles and analysis_sessions CASCADE from auth.users)
DELETE FROM auth.users;

-- 3. Verify (should show 0)
SELECT
  (SELECT COUNT(*) FROM auth.users) AS auth_users_count,
  (SELECT COUNT(*) FROM public.profiles) AS profiles_count;
