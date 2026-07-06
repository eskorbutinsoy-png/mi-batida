#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Lee el archivo SQL
const sqlPath = path.join(__dirname, 'supabase/migrations/20260703170000_20260703_fix_admin_registros.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('📝 Contenido del SQL a ejecutar:');
console.log('================================');
console.log(sql);
console.log('================================\n');

console.log('✅ Para ejecutar esta migración:\n');
console.log('1. Ve a: https://supabase.com/dashboard/project/abdwszaejrzqtjlvhakw/sql/new');
console.log('2. Copia el SQL anterior y pégalo en el editor');
console.log('3. Haz click en "Execute"');
console.log('\nO si tienes Supabase CLI instalado:');
console.log('   supabase db push\n');
