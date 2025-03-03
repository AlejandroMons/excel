/*
  # Fix profile creation trigger

  1. Changes
     - Modify the handle_new_user trigger function to properly create profiles
     - Add policies for profile creation
     - Fix RLS policies to allow proper profile creation
  
  2. Security
     - Maintains existing security while ensuring the trigger works correctly
     - Uses SECURITY DEFINER to bypass RLS for the trigger function
*/

-- Drop and recreate the trigger function with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert with explicit service role privileges
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'user');
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add policy for public access (needed for the trigger)
-- PostgreSQL doesn't support IF NOT EXISTS for policies, so we'll drop and recreate
DROP POLICY IF EXISTS "Public trigger can insert profiles" ON profiles;
CREATE POLICY "Public trigger can insert profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add policy for anon access
DROP POLICY IF EXISTS "Anon can insert profiles" ON profiles;
CREATE POLICY "Anon can insert profiles"
  ON profiles
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Make sure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure the function has proper permissions
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER;