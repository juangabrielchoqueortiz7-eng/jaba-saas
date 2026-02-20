const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const WABA_ID = '1439379724456162';

const s = createClient(
    'https://mnepydxofhcgbykpcyfc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZXB5ZHhvZmhjZ2J5a3BjeWZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNDUyNCwiZXhwIjoyMDg1ODEwNTI0fQ.TPoyJEprhaEGZtlu4V-NKhMyWywq4YQdNAK4j2Oc_BI'
);

async function main() {
    const output = [];
    const { data: creds } = await s.from('whatsapp_credentials').select('access_token, phone_number_id').limit(1).single();
    const token = creds.access_token;

    // Step 1: Check current subscriptions
    output.push('=== CURRENT SUBSCRIPTIONS ===');
    try {
        const resp = await fetch('https://graph.facebook.com/v21.0/' + WABA_ID + '/subscribed_apps', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await resp.json();
        output.push(JSON.stringify(data, null, 2));
    } catch (e) {
        output.push('ERROR: ' + e.message);
    }

    // Step 2: Subscribe the WABA to the app
    output.push('\n=== SUBSCRIBING WABA TO APP ===');
    try {
        const resp = await fetch('https://graph.facebook.com/v21.0/' + WABA_ID + '/subscribed_apps', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });
        const data = await resp.json();
        output.push(JSON.stringify(data, null, 2));
    } catch (e) {
        output.push('ERROR: ' + e.message);
    }

    // Step 3: Verify subscription after subscribing
    output.push('\n=== VERIFY SUBSCRIPTION ===');
    try {
        const resp = await fetch('https://graph.facebook.com/v21.0/' + WABA_ID + '/subscribed_apps', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await resp.json();
        output.push(JSON.stringify(data, null, 2));
    } catch (e) {
        output.push('ERROR: ' + e.message);
    }

    // Step 4: Save WABA ID to database
    output.push('\n=== SAVING WABA ID TO DATABASE ===');
    const { error } = await s.from('whatsapp_credentials').update({ waba_id: WABA_ID }).eq('phone_number_id', creds.phone_number_id);
    if (error) {
        output.push('DB ERROR: ' + error.message);
    } else {
        output.push('WABA ID saved successfully!');
    }

    fs.writeFileSync('scripts/subscribe_result.txt', output.join('\n'), 'utf8');
    console.log('Done - check scripts/subscribe_result.txt');
}

main().catch(console.error);
