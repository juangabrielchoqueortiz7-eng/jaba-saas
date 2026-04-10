// Run migration: add target_type and target_config to automation_jobs
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
    'https://mnepydxofhcgbykpcyfc.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
    const { error } = await supabase.rpc('exec_sql', {
        sql: `
            ALTER TABLE public.automation_jobs
              ADD COLUMN IF NOT EXISTS target_type VARCHAR(50) DEFAULT 'subscriptions_expiring',
              ADD COLUMN IF NOT EXISTS target_config JSONB DEFAULT '{}';
        `
    })
    if (error) {
        // Try direct query via REST
        console.error('RPC failed, trying direct:', error.message)
    } else {
        console.log('Migration applied successfully!')
    }
}

run()
