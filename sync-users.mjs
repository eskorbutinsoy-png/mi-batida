const token = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjNlNjE5YzJjIiwidHlwIjoiSldUIn0.eyJpc3MiOiJodHRwczovL2FsdC5zdXBhYmFzZS5pby9hdXRoL3YxIiwic3ViIjoiNGRkZmNiZjktMmYyOC00ZmMzLWFmYWQtZTFkYjAwMmE4OWYyIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsImV4cCI6MTc4MzM2MTQyNiwiaWF0IjoxNzgzMzU5NjI2LCJlbWFpbCI6ImVza29yYnV0aW5zb3lAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCIsImdpdGh1YiJdfSwidXNlcl9tZXRhZGF0YSI6eyJhdmF0YXJfdXJsIjoiaHR0cHM6Ly9hdmF0YXJzLmdpdGh1YnVzZXJjb250ZW50LmNvbS91LzI4NjQ2MDMzND92PTQiLCJlbWFpbCI6ImVza29yYnV0aW5zb3lAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImlzcyI6Imh0dHBzOi8vYXBpLmdpdGh1Yi5jb20iLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInByZWZlcnJlZF91c2VybmFtZSI6ImVza29yYnV0aW5zb3ktcG5nIiwicHJvdmlkZXJfaWQiOiIyODY0NjAzMzQiLCJzdWIiOiIyODY0NjAzMzQiLCJ1c2VyX25hbWUiOiJlc2tvcmJ1dGluc295LXBuZyJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzgzMzMzOTk4fV0sInNlc3Npb25faWQiOiIwNzgxYmEyNS0zNjE5LTRlNDgtODNlNS02YWYyOGI2NjFmNmMiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.apDiDQLeg4c81bcqtcxKCIA07CCeZgPak_Y8KxKcQnKt6SNd6POuDOOY9PEcuSyMqllINJUwKiYrZcaDBJJo2DQI8ZJ2WIfV1UA7jqpXyJoxcoHNUsMnwngwgs5Un60z9Ltbprrv7srixRZZ-eDNwnEhIdXec1qX3m_aMxyqgU8sLoCa05cjkkyBdyVSkoxnm0WJksZ5M-Ky_V5yJxfhKQ4tQICuajX1SwgzY7Q3TC6Qsd-_UteRHPi95RYP2X67meC-7nMI5olBRWBSvp1XT3IgmLVUnzGy2L_HVluT0X8r8ccquOoDIREtFpNPe4wgRc05ISpamVEfm0OURvAFXQ';

const sql = `
INSERT INTO public.registered_users (id, email, created_at, last_sign_in_at)
SELECT id, email, created_at, last_sign_in_at FROM auth.users
ON CONFLICT (email) DO UPDATE SET 
  last_sign_in_at = EXCLUDED.last_sign_in_at, 
  created_at = EXCLUDED.created_at;

CREATE OR REPLACE FUNCTION public.sync_user_to_registered()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.registered_users (id, email, created_at, last_sign_in_at)
  VALUES (NEW.id, NEW.email, NEW.created_at, NEW.last_sign_in_at)
  ON CONFLICT (email) DO UPDATE SET last_sign_in_at = EXCLUDED.last_sign_in_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_to_registered();
`;

async function run() {
  const res = await fetch('https://api.supabase.com/platform/pg-meta/abdwszaejrzqtjlvhakw/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query: sql })
  });
  
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Result:', text);
}

run().catch(console.error);
