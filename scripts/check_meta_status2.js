const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const s = createClient(
    'https://mnepydxofhcgbykpcyfc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZXB5ZHhvZmhjZ2J5a3BjeWZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNDUyNCwiZXhwIjoyMDg1ODEwNTI0fQ.TPoyJEprhaEGZtlu4V-NKhMyWywq4YQdNAK4j2Oc_BI'
);

async function main() {
    const output = [];

    const { data: creds } = await s.from('whatsapp_credentials').select('user_id, phone_number_id, access_token, waba_id').limit(1).single();

    if (!creds) { output.push('ERROR: No creds'); fs.writeFileSync('scripts/meta_check.txt', output.join('\n'), 'utf8'); return; }

    output.push('Phone Number ID: ' + creds.phone_number_id);
    output.push('WABA ID: ' + (creds.waba_id || 'NOT SET'));
    output.push('Token length: ' + (creds.access_token ? creds.access_token.length : 0));
    output.push('Token first 20: ' + (creds.access_token ? creds.access_token.substring(0, 20) : 'NONE'));

    const token = creds.access_token;

    // Check phone number
    try {
        const resp = await fetch('https://graph.facebook.com/v21.0/' + creds.phone_number_id + '?fields=verified_name,quality_rating,display_phone_number,status', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await resp.json();
        output.push('\nPHONE STATUS: ' + JSON.stringify(data, null, 2));
    } catch (e) {
        output.push('\nPHONE ERROR: ' + e.message);
    }

    // Check WABA if available
    if (creds.waba_id) {
        try {
            const resp = await fetch('https://graph.facebook.com/v21.0/' + creds.waba_id + '/subscribed_apps', {
                headers: { Authorization: 'Bearer ' + token }
            });
            const data = await resp.json();
            output.push('\nWABA SUBS: ' + JSON.stringify(data, null, 2));
        } catch (e) {
            output.push('\nWABA ERROR: ' + e.message);
        }
    }

    // Try to check debug token
    try {
        const resp = await fetch('https://graph.facebook.com/debug_token?input_token=' + token, {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await resp.json();
        output.push('\nTOKEN DEBUG: ' + JSON.stringify(data, null, 2));
    } catch (e) {
        output.push('\nTOKEN DEBUG ERROR: ' + e.message);
    }

    fs.writeFileSync('scripts/meta_check.txt', output.join('\n'), 'utf8');
    console.log('Output saved to scripts/meta_check.txt');
}

main().catch(console.error);
