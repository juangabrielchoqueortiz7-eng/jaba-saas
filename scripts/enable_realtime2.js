const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const s = createClient(
    'https://mnepydxofhcgbykpcyfc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZXB5ZHhvZmhjZ2J5a3BjeWZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNDUyNCwiZXhwIjoyMDg1ODEwNTI0fQ.TPoyJEprhaEGZtlu4V-NKhMyWywq4YQdNAK4j2Oc_BI'
);

async function main() {
    const output = [];

    // Step 1: Create a helper function that can run ALTER PUBLICATION
    output.push('=== CREATING HELPER FUNCTION ===');
    const { error: e1 } = await s.rpc('', {}).catch(() => ({}));

    // We need to create a function first, then call it
    // The function needs to be created via raw SQL
    // Let's try using the Supabase SQL API endpoint

    const SUPABASE_URL = 'https://mnepydxofhcgbykpcyfc.supabase.co';
    const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZXB5ZHhvZmhjZ2J5a3BjeWZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNDUyNCwiZXhwIjoyMDg1ODEwNTI0fQ.TPoyJEprhaEGZtlu4V-NKhMyWywq4YQdNAK4j2Oc_BI';

    // Try Supabase v1 SQL endpoint (unofficial but works)
    const sqlStatements = [
        // Create function to enable realtime
        `CREATE OR REPLACE FUNCTION public.enable_realtime_for_tables()
     RETURNS void AS $$
     BEGIN
       -- Try to add messages table
       BEGIN
         ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
         RAISE NOTICE 'Added messages table to realtime';
       EXCEPTION WHEN duplicate_object THEN
         RAISE NOTICE 'messages already in realtime';
       END;
       -- Try to add chats table
       BEGIN
         ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
         RAISE NOTICE 'Added chats table to realtime';
       EXCEPTION WHEN duplicate_object THEN
         RAISE NOTICE 'chats already in realtime';
       END;
     END;
     $$ LANGUAGE plpgsql SECURITY DEFINER;`,
    ];

    for (const sql of sqlStatements) {
        output.push('\nExecuting SQL...');
        try {
            const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/execute_sql', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + SERVICE_KEY,
                    'apikey': SERVICE_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sql })
            });
            const data = await resp.text();
            output.push('Result: ' + data);
        } catch (e) {
            output.push('Error: ' + e.message);
        }
    }

    // Alternative: Try using the pg_net extension or direct postgreSQL query
    // Actually, let's try creating the function via PostgREST
    output.push('\n=== TRYING VIA SUPABASE MANAGEMENT API ===');

    // Create the function and call it
    const createFnSql = `
    CREATE OR REPLACE FUNCTION public.enable_realtime_for_tables() 
    RETURNS text AS $$
    DECLARE result text := '';
    BEGIN
      BEGIN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
        result := result || 'messages: added. ';
      EXCEPTION WHEN duplicate_object THEN
        result := result || 'messages: already exists. ';
      END;
      BEGIN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chats';
        result := result || 'chats: added. ';
      EXCEPTION WHEN duplicate_object THEN
        result := result || 'chats: already exists. ';
      END;
      RETURN result;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

    // Try using the pg_query endpoint (Supabase-specific)
    try {
        const resp = await fetch(SUPABASE_URL + '/pg', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + SERVICE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: createFnSql })
        });
        const data = await resp.text();
        output.push('PG endpoint: ' + data);
    } catch (e) {
        output.push('PG endpoint error: ' + e.message);
    }

    fs.writeFileSync('scripts/enable_realtime_result.txt', output.join('\n'), 'utf8');
    console.log('Done - check scripts/enable_realtime_result.txt');
}

main().catch(console.error);
