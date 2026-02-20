const { createClient } = require('@supabase/supabase-js');

const s = createClient(
    'https://mnepydxofhcgbykpcyfc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZXB5ZHhvZmhjZ2J5a3BjeWZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNDUyNCwiZXhwIjoyMDg1ODEwNTI0fQ.TPoyJEprhaEGZtlu4V-NKhMyWywq4YQdNAK4j2Oc_BI'
);

async function main() {
    // 1. Get credentials
    const { data: creds } = await s.from('whatsapp_credentials').select('user_id, phone_number_id, access_token, waba_id').limit(1).single();

    if (!creds) {
        console.log('ERROR: No credentials found');
        return;
    }

    console.log('Phone Number ID:', creds.phone_number_id);
    console.log('WABA ID:', creds.waba_id || 'NOT SET');
    console.log('Token length:', creds.access_token ? creds.access_token.length : 0);

    const token = creds.access_token;

    // 2. Check phone number status
    console.log('\n=== PHONE NUMBER STATUS ===');
    try {
        const phoneResp = await fetch(`https://graph.facebook.com/v21.0/${creds.phone_number_id}?fields=verified_name,quality_rating,display_phone_number,status`, {
            headers: { Authorization: 'Bearer ' + token }
        });
        const phoneData = await phoneResp.json();
        console.log(JSON.stringify(phoneData, null, 2));
    } catch (e) {
        console.log('Error:', e.message);
    }

    // 3. Check WABA subscribed apps (if we have WABA ID)
    if (creds.waba_id) {
        console.log('\n=== WABA SUBSCRIBED APPS ===');
        try {
            const wabaResp = await fetch(`https://graph.facebook.com/v21.0/${creds.waba_id}/subscribed_apps`, {
                headers: { Authorization: 'Bearer ' + token }
            });
            const wabaData = await wabaResp.json();
            console.log(JSON.stringify(wabaData, null, 2));

            // If not subscribed, try to subscribe
            if (!wabaData.data || wabaData.data.length === 0) {
                console.log('\n=== SUBSCRIBING WABA ===');
                const subResp = await fetch(`https://graph.facebook.com/v21.0/${creds.waba_id}/subscribed_apps`, {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + token }
                });
                const subData = await subResp.json();
                console.log(JSON.stringify(subData, null, 2));
            }
        } catch (e) {
            console.log('Error:', e.message);
        }
    } else {
        // Try to find the WABA ID from the phone number
        console.log('\n=== FINDING WABA FROM PHONE ===');
        try {
            const bizResp = await fetch(`https://graph.facebook.com/v21.0/${creds.phone_number_id}?fields=id,display_phone_number,verified_name`, {
                headers: { Authorization: 'Bearer ' + token }
            });
            const bizData = await bizResp.json();
            console.log(JSON.stringify(bizData, null, 2));
        } catch (e) {
            console.log('Error:', e.message);
        }

        // Try app subscriptions
        console.log('\n=== CHECKING APP SUBSCRIPTIONS ===');
        try {
            const appResp = await fetch('https://graph.facebook.com/v21.0/4250242451896538/subscriptions', {
                headers: { Authorization: 'Bearer ' + token }
            });
            const appData = await appResp.json();
            console.log(JSON.stringify(appData, null, 2));
        } catch (e) {
            console.log('Error:', e.message);
        }
    }
}

main().catch(console.error);
