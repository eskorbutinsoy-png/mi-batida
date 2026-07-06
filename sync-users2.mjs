const token = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjNlNjE5YzJjIiwidHlwIjoiSldUIn0.eyJpc3MiOiJodHRwczovL2FsdC5zdXBhYmFzZS5pby9hdXRoL3YxIiwic3ViIjoiNGRkZmNiZjktMmYyOC00ZmMzLWFmYWQtZTFkYjAwMmE4OWYyIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsImV4cCI6MTc4MzM2MTQyNiwiaWF0IjoxNzgzMzU5NjI2LCJlbWFpbCI6ImVza29yYnV0aW5zb3lAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCIsImdpdGh1YiJdfSwidXNlcl9tZXRhZGF0YSI6eyJhdmF0YXJfdXJsIjoiaHR0cHM6Ly9hdmF0YXJzLmdpdGh1YnVzZXJjb250ZW50LmNvbS91LzI4NjQ2MDMzND92PTQiLCJlbWFpbCI6ImVza29yYnV0aW5zb3lAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImlzcyI6Imh0dHBzOi8vYXBpLmdpdGh1Yi5jb20iLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInByZWZlcnJlZF91c2VybmFtZSI6ImVza29yYnV0aW5zb3ktcG5nIiwicHJvdmlkZXJfaWQiOiIyODY0NjAzMzQiLCJzdWIiOiIyODY0NjAzMzQiLCJ1c2VyX25hbWUiOiJlc2tvcmJ1dGluc295LXBuZyJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzgzMzMzOTk4fV0sInNlc3Npb25faWQiOiIwNzgxYmEyNS0zNjE5LTRlNDgtODNlNS02YWYyOGI2NjFmNmMiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.apDiDQLeg4c81bcqtcxKCIA07CCeZgPak_Y8KxKcQnKt6SNd6POuDOOY9PEcuSyMqllINJUwKiYrZcaDBJJo2DQI8ZJ2WIfV1UA7jqpXyJoxcoHNUsMnwngwgs5Un60z9Ltbprrv7srixRZZ-eDNwnEhIdXec1qX3m_aMxyqgU8sLoCa05cjkkyBdyVSkoxnm0WJksZ5M-Ky_V5yJxfhKQ4tQICuajX1SwgzY7Q3TC6Qsd-_UteRHPi95RYP2X67meC-7nMI5olBRWBSvp1XT3IgmLVUnzGy2L_HVluT0X8r8ccquOoDIREtFpNPe4wgRc05ISpamVEfm0OURvAFXQ';

// Try with connection string in query param
const connStr = 'postgresql://postgres:Ioneltemible22@1@db.abdwszaejrzqtjlvhakw.supabase.co:5432/postgres';
const encodedConn = encodeURIComponent(connStr);

const sql = `INSERT INTO public.registered_users (id, email, created_at, last_sign_in_at)
SELECT id, email, created_at, last_sign_in_at FROM auth.users
ON CONFLICT (email) DO UPDATE SET 
  last_sign_in_at = EXCLUDED.last_sign_in_at, 
  created_at = EXCLUDED.created_at;`;

async function run() {
  // Try with connection_string query parameter
  const url1 = `https://api.supabase.com/platform/pg-meta/abdwszaejrzqtjlvhakw/query?connection_string=${encodedConn}`;
  const res1 = await fetch(url1, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ query: sql })
  });
  console.log('With conn string status:', res1.status);
  console.log('With conn string result:', (await res1.text()).substring(0, 300));
  
  // Also try the v1 projects API
  const res2 = await fetch(`https://api.supabase.com/v1/projects/abdwszaejrzqtjlvhakw/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ query: sql })
  });
  console.log('\nV1 API status:', res2.status);
  console.log('V1 API result:', (await res2.text()).substring(0, 300));
}

run().catch(console.error);
