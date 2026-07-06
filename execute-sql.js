import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = 'https://abdwszaejrzqtjlvhakw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZHdzemFlamp6anRsaHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDMyNTAxMDcsImV4cCI6MTcwMzI4NjEwN30.OhLcdMbAjkJZu8c2v-WVHH0e0p0kNOq0YdBJdLpj3v0'

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Read the SQL file
const sqlFilePath = path.join(process.cwd(), 'supabase/migrations/20260706_create_public_registered_users.sql')
const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8')

console.log('📡 Executing SQL migration...')
console.log('================================================')
console.log(sqlContent.substring(0, 300) + '...')
console.log('================================================')

// Execute SQL via Supabase API
async function executeSql() {
  try {
    const { data, error } = await supabase.rpc('exec', {
      sql: sqlContent
    })
    
    if (error) {
      console.error('❌ Error executing SQL:', error)
      process.exit(1)
    }
    
    console.log('✅ SQL executed successfully!')
    console.log('📊 Result:', data)
    
    // Verify users were created
    const { data: users, error: selectError } = await supabase
      .from('registered_users')
      .select('*')
    
    if (selectError) {
      console.error('❌ Error reading users:', selectError)
      process.exit(1)
    }
    
    console.log('\n✅ Users created:')
    users.forEach(user => {
      console.log(`   • ${user.email}`)
    })
    
  } catch (err) {
    console.error('❌ Unexpected error:', err)
    process.exit(1)
  }
}

executeSql()
