-- Create app_registered_users table to track registered users with management features
CREATE TABLE IF NOT EXISTS app_registered_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  last_activity TIMESTAMP WITH TIME ZONE,
  is_blocked BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_app_registered_users_email ON app_registered_users(email);
CREATE INDEX IF NOT EXISTS idx_app_registered_users_is_blocked ON app_registered_users(is_blocked);
CREATE INDEX IF NOT EXISTS idx_app_registered_users_last_activity ON app_registered_users(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_app_registered_users_created_at ON app_registered_users(created_at DESC);

-- Enable RLS
ALTER TABLE app_registered_users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admin (eskorbutinsoy@gmail.com) can see all users
CREATE POLICY "Admin can view all registered users" 
  ON app_registered_users FOR SELECT 
  USING (auth.jwt() ->> 'email' = 'eskorbutinsoy@gmail.com');

-- RLS Policy: Admin can update user records
CREATE POLICY "Admin can update registered users" 
  ON app_registered_users FOR UPDATE 
  USING (auth.jwt() ->> 'email' = 'eskorbutinsoy@gmail.com');

-- RLS Policy: Admin can delete user records
CREATE POLICY "Admin can delete registered users" 
  ON app_registered_users FOR DELETE 
  USING (auth.jwt() ->> 'email' = 'eskorbutinsoy@gmail.com');

-- RLS Policy: Allow auto-insert via trigger for new users
CREATE POLICY "Users can insert own registration" 
  ON app_registered_users FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- RLS Policy: Users can view their own record
CREATE POLICY "Users can view their own registration" 
  ON app_registered_users FOR SELECT 
  USING (auth.uid() = id);

-- Trigger: Automatically create registration record when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.app_registered_users (id, email, created_at, last_sign_in_at)
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NEW.last_sign_in_at
  )
  ON CONFLICT (id) DO UPDATE SET
    last_sign_in_at = NEW.last_sign_in_at,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert all existing auth users into app_registered_users
INSERT INTO app_registered_users (id, email, created_at, last_sign_in_at)
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;
