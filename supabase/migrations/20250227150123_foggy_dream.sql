/*
  # Fix profile creation issues
  
  1. Changes
     - Add ON CONFLICT DO NOTHING to the handle_new_user trigger function
     - Improve error handling in the trigger function
     - Add additional policies to ensure proper access
  
  2. Security
     - Maintain existing RLS policies
     - Ensure trigger function has proper permissions
*/

-- Drop and recreate the trigger function with proper conflict handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert with ON CONFLICT DO NOTHING to prevent duplicate key violations
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'user')
  ON CONFLICT (id) DO NOTHING;
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the function has proper permissions
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER;

-- Make sure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add additional policies to ensure proper access
DROP POLICY IF EXISTS "Service role can manage profiles" ON profiles;
CREATE POLICY "Service role can manage profiles"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);