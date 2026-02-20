const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const s = createClient(
    'https://mnepydxofhcgbykpcyfc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZXB5ZHhvZmhjZ2J5a3BjeWZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNDUyNCwiZXhwIjoyMDg1ODEwNTI0fQ.TPoyJEprhaEGZtlu4V-NKhMyWywq4YQdNAK4j2Oc_BI'
);

async function main() {
    const output = [];

    const { data: creds } = await s.from('whatsapp_credentials').select('user_id, phone_number_id, access_token, waba_id').limit(1).single();
    const token = creds.access_token;

    // Step 1: Find WABA ID from the phone number  
    output.push('=== FINDING WABA ID ===');

    // Get the WhatsApp Business Account ID that owns this phone number
    try {
        const resp = await fetch('https://graph.facebook.com/v21.0/' + creds.phone_number_id + '?fields=id,display_phone_number,verified_name,account_mode', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await resp.json();
        output.push('Phone data: ' + JSON.stringify(data, null, 2));
    } catch (e) {
        output.push('ERROR: ' + e.message);
    }

    // Step 2: Try to get business info from the app
    try {
        const resp = await fetch('https://graph.facebook.com/v21.0/4250242451896538?fields=id,name', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await resp.json();
        output.push('\nApp info: ' + JSON.stringify(data, null, 2));
    } catch (e) {
        output.push('App ERROR: ' + e.message);
    }

    // Step 3: Get business accounts the system user can access
    try {
        const resp = await fetch('https://graph.facebook.com/v21.0/122106932103247412/assigned_business_asset_groups', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await resp.json();
        output.push('\nBusiness assets: ' + JSON.stringify(data, null, 2));
    } catch (e) {
        output.push('Assets ERROR: ' + e.message);
    }

    // Step 4: Try common WABA endpoint patterns
    // Use the debug token to get the business ID
    try {
        const resp = await fetch('https://graph.facebook.com/v21.0/me?fields=id,name', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await resp.json();
        output.push('\nMe: ' + JSON.stringify(data, null, 2));
    } catch (e) {
        output.push('Me ERROR: ' + e.message);
    }

    // Step 5: Try to find the WABA ID by listing shared WABAs
    try {
        const resp = await fetch('https://graph.facebook.com/v21.0/122106932103247412/assigned_pages', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await resp.json();
        output.push('\nAssigned pages: ' + JSON.stringify(data, null, 2));
    } catch (e) {
        output.push('Pages ERROR: ' + e.message);
    }

    // Step 6: Try listing phone numbers owner (WABA)
    try {
        const resp = await fetch('https://graph.facebook.com/v21.0/' + creds.phone_number_id + '/owner', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await resp.json();
        output.push('\nPhone owner: ' + JSON.stringify(data, null, 2));
    } catch (e) {
        output.push('Owner ERROR: ' + e.message);
    }

    fs.writeFileSync('scripts/find_waba.txt', output.join('\n'), 'utf8');
    console.log('Done - check scripts/find_waba.txt');
}

main().catch(console.error);
