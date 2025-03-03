/*
  # Fix profiles RLS policies

  1. Changes
     - Add policy to allow authenticated users to insert their own profile
     - Add policy to allow service role to insert profiles (for trigger function)
     - Add policy to allow users to update their own profile
  
  2. Security
     - Maintains existing security while adding necessary permissions
     - Ensures users can only manage their own profiles
     - Allows the trigger function to create profiles
*/

-- Allow users to insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Allow the trigger function to create profiles (using service role)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER;