import pkg from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// PostgreSQL connection string
// Format: postgres://user:password@host:port/database
const connectionString = 'postgres://postgres:Ioneltemible22@@abdwszaejrzqtjlvhakw.supabase.co:5432/postgres';

async function executeSql() {
  const client = new Client({ connectionString });
  
  try {
    console.log('🔗 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!');
    
    // Read SQL file
    const sqlFile = path.join(__dirname, 'supabase/migrations/20260706_create_public_registered_users.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf-8');
    
    console.log('\n📡 Executing migration...\n');
    
    // Execute the SQL
    const result = await client.query(sqlContent);
    
    console.log('✅ Migration executed successfully!');
    console.log(`📊 Rows affected: ${result.rowCount}`);
    
    // Verify users were created
    console.log('\n✅ Verifying users...');
    const checkQuery = 'SELECT email, created_at, last_sign_in_at, is_blocked FROM public.registered_users ORDER BY created_at DESC;';
    const usersResult = await client.query(checkQuery);
    
    console.log(`\n✅ Found ${usersResult.rows.length} users:\n`);
    usersResult.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.email}`);
      console.log(`      Created: ${row.created_at}`);
      console.log(`      Last sign-in: ${row.last_sign_in_at}`);
      console.log(`      Blocked: ${row.is_blocked}\n`);
    });
    
    console.log('✅ DONE! Users should now appear in the Admin App');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('Details:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeSql();
