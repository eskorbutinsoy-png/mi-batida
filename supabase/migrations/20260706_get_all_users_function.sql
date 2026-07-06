-- Create RPC function to get all users (admin only)
CREATE OR REPLACE FUNCTION public.get_all_registered_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  last_sign_in_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Only allow admin
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'eskorbutinsoy@gmail.com' THEN
    RAISE EXCEPTION 'Only admin can access this function';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_all_registered_users() TO authenticated;
