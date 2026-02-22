-- =============================================================================
-- LOGOS: Verify and fix auth (run in Supabase Dashboard → SQL Editor)
--
-- How to use:
-- 1. Open your project → SQL Editor → New query.
-- 2. Run sections 1–3 first to VERIFY (see if users exist, profiles exist).
-- 3. Run sections 4–5 to FIX (safe trigger + backfill profiles).
-- 4. To let existing users sign in without email confirmation: run the
--    single line in section 6 (uncomment it and run).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. VERIFY: List all users in Auth
-- -----------------------------------------------------------------------------
SELECT
  id,
  email,
  email_confirmed_at IS NOT NULL AS confirmed,
  email_confirmed_at,
  created_at,
  raw_user_meta_data->>'username' AS username
FROM auth.users
ORDER BY created_at DESC;

-- -----------------------------------------------------------------------------
-- 2. VERIFY: List all profiles (should match auth.users if trigger ran)
-- -----------------------------------------------------------------------------
SELECT id, username, email, updated_at
FROM public.profiles
ORDER BY updated_at DESC;

-- -----------------------------------------------------------------------------
-- 3. VERIFY: Users in auth but missing profile (trigger may have failed)
-- -----------------------------------------------------------------------------
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- -----------------------------------------------------------------------------
-- 4. FIX: Make trigger idempotent so signup never fails due to profile insert
--    (If trigger failed before, new signups will work; run this once.)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 5. FIX: Backfill missing profiles for existing auth users
--    (Run after step 4 so users who exist in auth but not in profiles get a row.)
-- -----------------------------------------------------------------------------
INSERT INTO public.profiles (id, username, email)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'username', SPLIT_PART(u.email, '@', 1)),
  u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO UPDATE SET
  username = COALESCE(EXCLUDED.username, public.profiles.username),
  email = COALESCE(EXCLUDED.email, public.profiles.email),
  updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 6. FIX: Confirm all users so they can sign in without email verification
--    (Only run if you want to skip email confirmation for existing users.)
-- -----------------------------------------------------------------------------
-- Run this to let all existing users sign in (no email confirmation required):
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;

-- -----------------------------------------------------------------------------
-- 7. VERIFY AGAIN: Counts should match
-- -----------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM auth.users) AS auth_users_count,
  (SELECT COUNT(*) FROM public.profiles) AS profiles_count;
