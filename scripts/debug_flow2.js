const { createClient } = require('@supabase/supabase-js');

const s = createClient(
    'https://mnepydxofhcgbykpcyfc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZXB5ZHhvZmhjZ2J5a3BjeWZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNDUyNCwiZXhwIjoyMDg1ODEwNTI0fQ.TPoyJEprhaEGZtlu4V-NKhMyWywq4YQdNAK4j2Oc_BI'
);

async function main() {
    const r1 = await s.from('whatsapp_credentials').select('user_id, phone_number_id, phone_number_display, ai_status');
    console.log('CREDS:');
    if (r1.data) {
        for (const c of r1.data) {
            console.log('  uid=' + (c.user_id || '').substring(0, 8) + ' pid=' + c.phone_number_id + ' display=' + c.phone_number_display + ' ai=' + c.ai_status);
        }
    }

    const r2 = await s.from('chats').select('id, phone_number, contact_name, user_id, last_message, last_message_time').order('last_message_time', { ascending: false }).limit(5);
    console.log('CHATS:');
    if (r2.data) {
        for (const c of r2.data) {
            console.log('  ' + (c.contact_name || c.phone_number) + ' | uid=' + (c.user_id || 'NULL').toString().substring(0, 8) + ' | ' + c.last_message_time + ' | ' + (c.last_message || '').substring(0, 40));
        }
    }

    const r3 = await s.from('messages').select('id, chat_id, content, is_from_me, created_at').order('created_at', { ascending: false }).limit(10);
    console.log('MSGS:');
    if (r3.data) {
        for (const m of r3.data) {
            console.log('  ' + m.created_at + ' | mine=' + m.is_from_me + ' | ' + (m.content || '').substring(0, 50));
        }
    }
}

main().catch(console.error);
