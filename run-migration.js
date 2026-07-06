import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://abdwszaejrzqtjlvhakw.supabase.co';
// Get service role key from environment or prompt
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY no está definida en variables de entorno');
  console.error('Necesitas ejecutar esta migración manualmente en el SQL Editor de Supabase');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runMigration() {
  try {
    const migrationSql = readFileSync(
      join(__dirname, 'supabase/migrations/20260703170000_20260703_fix_admin_registros.sql'),
      'utf8'
    );

    console.log('📝 Ejecutando migración...');
    console.log(migrationSql.substring(0, 200) + '...');

    // Execute the SQL
    const { error } = await supabase.rpc('_execute_sql', { sql: migrationSql });
    
    if (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }

    console.log('✅ Migración ejecutada exitosamente');
  } catch (err) {
    console.error('❌ Error al leer el archivo de migración:', err.message);
    process.exit(1);
  }
}

runMigration();
