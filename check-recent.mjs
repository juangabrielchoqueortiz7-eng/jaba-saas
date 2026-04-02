import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const getEnv = (key) => { const m = env.match(new RegExp(`^${key}=(.+)$`, 'm')); return m ? m[1].trim() : null }
const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('JABA_ADMIN_KEY'))

async function debug() {
    console.log('=== CHECKING RECENT MESSAGES (LAST 30 MIN) ===\n')

    const thirtyMinsAgo = new Date(Date.now() - 30*60*1000).toISOString()
    
    // 1. Mensajes del cliente
    const { data: inbound } = await supabase.from('messages')
        .select('*')
        .gte('created_at', thirtyMinsAgo)
        .eq('is_from_me', false)
        .order('created_at', { ascending: false })
    
    console.log(`Mensajes entrantes (cliente -> bot): ${inbound?.length || 0}`)
    if (inbound?.length) {
        for (const m of inbound) console.log(`  [${m.created_at}] ${m.content}`)
    }

    // 2. Chats actualizados
    const { data: chats } = await supabase.from('chats')
        .select('id, contact_name, last_message, unread_count, last_message_time')
        .gte('last_message_time', thirtyMinsAgo)
        .order('last_message_time', { ascending: false })
    
    console.log(`\nChats actualizados: ${chats?.length || 0}`)
    if (chats?.length) {
        for (const c of chats) console.log(`  [${c.last_message_time}] ${c.contact_name}: "${c.last_message}" (unread: ${c.unread_count})`)
    }
}

debug().catch(console.error)
