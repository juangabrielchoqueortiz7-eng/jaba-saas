import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const getEnv = (key) => { const m = env.match(new RegExp(`^${key}=(.+)$`, 'm')); return m ? m[1].trim() : null }
const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('JABA_ADMIN_KEY'))

const lines = []
const log = (s) => { lines.push(s) }

async function debug() {
    log('=== CHECK CONSTRAINTS + TRIGGERS ===\n')

    // Check indexes and constraints on messages table
    const { data: indexes } = await supabase.rpc('exec_sql', {
        sql: `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'messages' ORDER BY indexname`
    })
    if (indexes) {
        log('INDEXES on messages:')
        for (const idx of indexes) log(`  ${idx.indexname}: ${idx.indexdef}`)
    }

    // Check constraints
    const { data: constraints } = await supabase.rpc('exec_sql', {
        sql: `SELECT conname, contype, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'public.messages'::regclass`
    })
    if (constraints) {
        log('\nCONSTRAINTS on messages:')
        for (const c of constraints) log(`  ${c.conname} (${c.contype}): ${c.def}`)
    }

    // Check triggers on messages
    const { data: triggers } = await supabase.rpc('exec_sql', {
        sql: `SELECT trigger_name, event_manipulation, action_statement FROM information_schema.triggers WHERE event_object_table = 'messages'`
    })
    if (triggers) {
        log('\nTRIGGERS on messages:')
        for (const t of triggers) log(`  ${t.trigger_name}: ${t.event_manipulation} -> ${t.action_statement}`)
    }

    // Check column defaults
    const { data: cols } = await supabase.rpc('exec_sql', {
        sql: `SELECT column_name, column_default, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'messages' ORDER BY ordinal_position`
    })
    if (cols) {
        log('\nCOLUMNS of messages:')
        for (const c of cols) log(`  ${c.column_name}: ${c.data_type} default=${c.column_default||'null'} nullable=${c.is_nullable}`)
    }

    // If none of the RPCs worked, try raw queries
    if (!indexes && !constraints) {
        log('\nRPC exec_sql not available. Trying alternative...')
        
        // Just try to insert a test message directly
        const testChatId = '15e37f99-ba0d-4bd9-9874-56c43a30f724'
        const testWaId = 'test_wamid_' + Date.now()
        
        log('\nTEST: Insert with whatsapp_message_id...')
        const { data: t1, error: e1 } = await supabase.from('messages').insert({
            chat_id: testChatId,
            is_from_me: false,
            content: '[TEST] with wa_id',
            status: 'delivered',
            whatsapp_message_id: testWaId
        }).select('id, is_from_me, whatsapp_message_id').single()
        
        if (e1) {
            log(`  ERROR: ${e1.message} | code: ${e1.code} | details: ${e1.details}`)
        } else {
            log(`  OK: id=${t1.id} is_from_me=${t1.is_from_me} wa_id=${t1.whatsapp_message_id}`)
            // Try inserting SAME wa_id again
            const { error: e2 } = await supabase.from('messages').insert({
                chat_id: testChatId, is_from_me: false, content: '[TEST] duplicate wa_id',
                status: 'delivered', whatsapp_message_id: testWaId
            })
            if (e2) {
                log(`  DUPLICATE wa_id ERROR: ${e2.message} | code: ${e2.code}`)
            } else {
                log(`  DUPLICATE wa_id: ALLOWED (no unique constraint)`)
            }
            // Cleanup
            await supabase.from('messages').delete().eq('whatsapp_message_id', testWaId)
            log('  Cleaned up test records')
        }
    }

    writeFileSync('debug-output5.txt', lines.join('\n'), 'utf8')
    console.log('Guardado en debug-output5.txt')
}

debug().catch(console.error)
