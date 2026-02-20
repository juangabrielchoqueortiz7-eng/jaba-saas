const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const s = createClient(
    'https://mnepydxofhcgbykpcyfc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZXB5ZHhvZmhjZ2J5a3BjeWZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNDUyNCwiZXhwIjoyMDg1ODEwNTI0fQ.TPoyJEprhaEGZtlu4V-NKhMyWywq4YQdNAK4j2Oc_BI'
);

async function main() {
    const lines = [];

    const r1 = await s.from('whatsapp_credentials').select('user_id, phone_number_id, phone_number_display, ai_status');
    lines.push('=== CREDENTIALS ===');
    if (r1.data) {
        for (const c of r1.data) {
            lines.push('uid=' + c.user_id + ' | pid=' + c.phone_number_id + ' | display=' + c.phone_number_display + ' | ai=' + c.ai_status);
        }
    }

    const r2 = await s.from('chats').select('id, phone_number, contact_name, user_id, last_message, last_message_time').order('last_message_time', { ascending: false }).limit(5);
    lines.push('\n=== RECENT CHATS ===');
    if (r2.data) {
        for (const c of r2.data) {
            lines.push(c.contact_name + ' | phone=' + c.phone_number + ' | uid=' + c.user_id + ' | time=' + c.last_message_time + ' | msg=' + (c.last_message || '').substring(0, 60));
        }
    }

    const r3 = await s.from('messages').select('id, chat_id, content, is_from_me, created_at').order('created_at', { ascending: false }).limit(10);
    lines.push('\n=== RECENT MESSAGES ===');
    if (r3.data) {
        for (const m of r3.data) {
            lines.push(m.created_at + ' | mine=' + m.is_from_me + ' | ' + (m.content || '').substring(0, 60));
        }
    }

    fs.writeFileSync('scripts/db_state.json', JSON.stringify({ credentials: r1.data, chats: r2.data, messages: r3.data }, null, 2), 'utf8');
    fs.writeFileSync('scripts/db_state.txt', lines.join('\n'), 'utf8');
}

main().catch(console.error);
