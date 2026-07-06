import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = 'https://abdwszaejrzqtjlvhakw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZHdzemFlanJ6cXRqbHZoYWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDQwOTIsImV4cCI6MjA5ODUyMDA5Mn0.dFp-K59inlYrdCRa4hC9EP5ukMJIviaiLilzchf6l8c'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function main() {
  try {
    console.log('🔐 Logging in as admin user...')
    
    // Login as admin
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'eskorbutinsoy@gmail.com',
      password: 'Ioneltemible22@'
    })
    
    if (authError) {
      console.error('❌ Authentication failed:', authError.message)
      process.exit(1)
    }
    
    console.log('✅ Logged in successfully!')
    
    // Now create a new client with the admin session
    const adminSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${authData.session.access_token}`
        }
      }
    })
    
    console.log('\n📡 Creating registered_users table...')
    
    // Read the SQL file
    const sqlContent = fs.readFileSync(
      path.join(__dirname, 'supabase/migrations/20260706_create_public_registered_users.sql'),
      'utf-8'
    )
    
    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    
    for (const statement of statements) {
      if (statement.startsWith('--')) continue
      
      const { error } = await adminSupabase.rpc('exec_sql', { sql: statement })
      
      if (error && !error.message.includes('already exists')) {
        console.error(`❌ Error: ${error.message}`)
      }
    }
    
    console.log('✅ Tables created!')
    
    // Verify users were created
    console.log('\n📊 Verifying users...')
    const { data: users, error: selectError } = await adminSupabase
      .from('registered_users')
      .select('*')
    
    if (selectError) {
      console.error('❌ Error reading users:', selectError.message)
      process.exit(1)
    }
    
    console.log(`✅ Found ${users.length} users:`)
    users.forEach(user => {
      console.log(`   • ${user.email}`)
    })
    
    console.log('\n✅ DONE! Users should now appear in the Admin App')
    
  } catch (err) {
    console.error('❌ Unexpected error:', err.message)
    process.exit(1)
  }
}

main()
