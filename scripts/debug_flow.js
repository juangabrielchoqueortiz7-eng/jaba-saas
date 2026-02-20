const { createClient } = require('@supabase/supabase-js');

const s = createClient(
    'https://mnepydxofhcgbykpcyfc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZXB5ZHhvZmhjZ2J5a3BjeWZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNDUyNCwiZXhwIjoyMDg1ODEwNTI0fQ.TPoyJEprhaEGZtlu4V-NKhMyWywq4YQdNAK4j2Oc_BI'
);

async function main() {
    // 1. Check credentials
    const r1 = await s.from('whatsapp_credentials').select('user_id, phone_number_id, phone_number_display, ai_status');
    console.log('=== CREDENTIALS ===');
    if (r1.data) r1.data.forEach(c => console.log(`  uid=${c.user_id} pid=${c.phone_number_id} display=${c.phone_number_display} ai=${c.ai_status}`));
    if (r1.error) console.log('  ERROR:', r1.error.message);

    // 2. Check recent chats
    const r2 = await s.from('chats').select('id, phone_number, contact_name, user_id, last_message, last_message_time').order('last_message_time', { ascending: false }).limit(5);
    console.log('\n=== RECENT CHATS ===');
    if (r2.data) r2.data.forEach(c => console.log(`  [${c.id.substring(0, 8)}] ${c.contact_name || c.phone_number} | uid=${c.user_id ? c.user_id.substring(0, 8) : 'NULL'} | ${c.last_message_time} | "${c.last_message}"`));
    if (r2.error) console.log('  ERROR:', r2.error.message);

    // 3. Check recent messages
    const r3 = await s.from('messages').select('id, chat_id, content, is_from_me, created_at').order('created_at', { ascending: false }).limit(10);
    console.log('\n=== RECENT MESSAGES ===');
    if (r3.data) r3.data.forEach(m => console.log(`  ${m.created_at} | from_me=${m.is_from_me} | "${(m.content || '').substring(0, 60)}"`));
    if (r3.error) console.log('  ERROR:', r3.error.message);

    // 4. Test webhook POST with a simulated message
    console.log('\n=== TESTING WEBHOOK POST ===');
    const testPayload = {
        object: 'whatsapp_business_account',
        entry: [{
            id: 'WABA_ID',
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                        display_phone_number: '59169344192',
                        phone_number_id: r1.data?.[0]?.phone_number_id || 'UNKNOWN'
                    },
                    contacts: [{ profile: { name: 'Test Debug' }, wa_id: '59100000000' }],
                    messages: [{
                        from: '59100000000',
                        id: 'wamid.test_debug_' + Date.now(),
                        timestamp: Math.floor(Date.now() / 1000).toString(),
                        text: { body: 'TEST DEBUG MESSAGE ' + new Date().toISOString() },
                        type: 'text'
                    }]
                },
                field: 'messages'
            }]
        }]
    };

    try {
        const resp = await fetch('https://jabachat.com/api/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload)
        });
        const text = await resp.text();
        console.log(`  Status: ${resp.status} | Body: "${text}"`);
    } catch (e) {
        console.log('  FETCH ERROR:', e.message);
    }
}

main().catch(console.error);
