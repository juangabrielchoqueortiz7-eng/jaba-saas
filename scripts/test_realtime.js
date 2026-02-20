const fs = require('fs');

// Use direct PostgreSQL connection via Supabase Management API
// Or we can try using the SQL endpoint
async function main() {
    const output = [];
    const SUPABASE_URL = 'https://mnepydxofhcgbykpcyfc.supabase.co';
    const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZXB5ZHhvZmhjZ2J5a3BjeWZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNDUyNCwiZXhwIjoyMDg1ODEwNTI0fQ.TPoyJEprhaEGZtlu4V-NKhMyWywq4YQdNAK4j2Oc_BI';

    // Method 1: Check if tables are in the realtime publication by querying pg_publication_tables
    output.push('=== CHECKING PUBLICATION VIA REST ===');
    try {
        const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/get_realtime_tables', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + SERVICE_KEY,
                'apikey': SERVICE_KEY,
                'Content-Type': 'application/json'
            },
            body: '{}'
        });
        const data = await resp.json();
        output.push('RPC result: ' + JSON.stringify(data));
    } catch (e) {
        output.push('RPC error: ' + e.message);
    }

    // Method 2: Try to enable realtime via SQL using pg_net or raw query
    // The supabase_realtime publication needs to include the tables
    // We can try using the Supabase Edge Function SQL endpoint

    const sqls = [
        "SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'",
    ];

    for (const sql of sqls) {
        output.push('\nSQL: ' + sql);
        try {
            // Try via PostgREST
            const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/raw_sql', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + SERVICE_KEY,
                    'apikey': SERVICE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ query: sql })
            });
            const data = await resp.json();
            output.push('Result: ' + JSON.stringify(data));
        } catch (e) {
            output.push('Error: ' + e.message);
        }
    }

    // Method 3: Test realtime connection directly
    output.push('\n=== TESTING REALTIME CONNECTION ===');
    const { createClient } = require('@supabase/supabase-js');
    const s = createClient(SUPABASE_URL, SERVICE_KEY, {
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        }
    });

    // Subscribe and wait for a test insert
    const channel = s
        .channel('test_realtime_check')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'messages'
        }, (payload) => {
            output.push('GOT REALTIME EVENT: ' + JSON.stringify(payload).substring(0, 200));
        })
        .subscribe((status) => {
            output.push('Subscription status: ' + status);
        });

    // Wait 3 seconds for subscription to establish
    await new Promise(r => setTimeout(r, 3000));
    output.push('Channel state: ' + channel.state);

    // Insert a test message and see if we get a realtime event
    const { data: testInsert, error: insertErr } = await s.from('messages').insert({
        chat_id: '9f65d769-4a8e-4974-9d3b-53cea7f4bf73',
        content: 'REALTIME_TEST_' + Date.now(),
        is_from_me: true,
        status: 'sent'
    }).select().single();

    output.push('Test insert: ' + (insertErr ? 'ERROR: ' + insertErr.message : 'OK id=' + testInsert?.id));

    // Wait 3 more seconds for the realtime event
    await new Promise(r => setTimeout(r, 3000));

    // Cleanup
    if (testInsert) {
        await s.from('messages').delete().eq('id', testInsert.id);
        output.push('Test message cleaned up');
    }

    s.removeChannel(channel);

    fs.writeFileSync('scripts/realtime_test.txt', output.join('\n'), 'utf8');
    console.log('Done - check scripts/realtime_test.txt');
    process.exit(0);
}

main().catch(console.error);
