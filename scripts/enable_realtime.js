const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const s = createClient(
    'https://mnepydxofhcgbykpcyfc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZXB5ZHhvZmhjZ2J5a3BjeWZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNDUyNCwiZXhwIjoyMDg1ODEwNTI0fQ.TPoyJEprhaEGZtlu4V-NKhMyWywq4YQdNAK4j2Oc_BI'
);

async function main() {
    const output = [];

    // Check current realtime publication tables
    output.push('=== CURRENT REALTIME PUBLICATION ===');
    const { data: pubTables, error: e1 } = await s.rpc('execute_sql', {
        sql: "SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';"
    });

    if (e1) {
        output.push('Cannot check via RPC, trying direct query...');
        // Alternative: just enable realtime
    }
    output.push(JSON.stringify(pubTables, null, 2));

    // Enable realtime for messages table
    output.push('\n=== ENABLING REALTIME FOR MESSAGES ===');
    const { error: e2 } = await s.rpc('execute_sql', {
        sql: "ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;"
    });
    output.push(e2 ? 'Error: ' + e2.message : 'SUCCESS');

    // Enable realtime for chats table
    output.push('\n=== ENABLING REALTIME FOR CHATS ===');
    const { error: e3 } = await s.rpc('execute_sql', {
        sql: "ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;"
    });
    output.push(e3 ? 'Error: ' + e3.message : 'SUCCESS');

    fs.writeFileSync('scripts/realtime_result.txt', output.join('\n'), 'utf8');
    console.log('Done - check scripts/realtime_result.txt');
}

main().catch(console.error);
