/*
  # Seed Admin User

  1. Data Seeding
    - Creates an admin user in the profiles table
    - Note: You'll need to create this user through Supabase Auth first
      and then update this script with the correct UUID
*/

-- Insert admin user (replace UUID with actual user ID after creating in Supabase Auth)
DO $$
BEGIN
  -- This is just a placeholder. You'll need to create a user through Supabase Auth
  -- and then update this with the correct UUID
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin') THEN
    -- This is just to remind you to create an admin user through the Supabase interface
    -- or programmatically and then update their role to 'admin'
    RAISE NOTICE 'Please create an admin user through Supabase Auth and update their role to admin';
  END IF;
END
$$;