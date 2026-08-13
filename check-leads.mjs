import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
// need to use anon key or get service key
// We'll just read from DB to check leads
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY 
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkLeads() {
  console.log("Checking leads...")
  const { data: leads, error } = await supabase.from('leads').select('*')
  if (error) {
    console.error("Error fetching leads:", error)
    return
  }
  console.log(`Found ${leads.length} leads`)
  console.log(JSON.stringify(leads, null, 2))
}

checkLeads()
