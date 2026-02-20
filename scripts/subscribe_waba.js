const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const s = createClient(
    'https://mnepydxofhcgbykpcyfc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZXB5ZHhvZmhjZ2J5a3BjeWZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIzNDUyNCwiZXhwIjoyMDg1ODEwNTI0fQ.TPoyJEprhaEGZtlu4V-NKhMyWywq4YQdNAK4j2Oc_BI'
);

async function main() {
    const output = [];
    const { data: creds } = await s.from('whatsapp_credentials').select('access_token').limit(1).single();
    const token = creds.access_token;

    // The business_id can be found via the app's settings or the system user
    // Try: get list of WABAs the system user has access to
    const endpoints = [
        // Try to get WABAs owned by the business
        'https://graph.facebook.com/v21.0/122106932103247412/businesses',
        // Try shared WABAs
        'https://graph.facebook.com/v21.0/me/businesses',
        // Try WhatsApp Business Accounts directly
        'https://graph.facebook.com/v21.0/me/whatsapp_business_accounts',
    ];

    for (const url of endpoints) {
        try {
            const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
            const data = await resp.json();
            output.push(url.split('v21.0/')[1] + ': ' + JSON.stringify(data));
        } catch (e) {
            output.push(url + ' ERROR: ' + e.message);
        }
    }

    // Try to get WABA from the business associated with the app
    // First, get the business
    try {
        const resp = await fetch('https://graph.facebook.com/v21.0/4250242451896538?fields=business', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await resp.json();
        output.push('\nApp business: ' + JSON.stringify(data));

        if (data.business && data.business.id) {
            const bizId = data.business.id;
            output.push('Business ID: ' + bizId);

            // Get WABAs for this business
            const wabaResp = await fetch('https://graph.facebook.com/v21.0/' + bizId + '/owned_whatsapp_business_accounts', {
                headers: { Authorization: 'Bearer ' + token }
            });
            const wabaData = await wabaResp.json();
            output.push('WABAs: ' + JSON.stringify(wabaData, null, 2));

            // If we found a WABA, subscribe it
            if (wabaData.data && wabaData.data.length > 0) {
                const wabaId = wabaData.data[0].id;
                output.push('\nFOUND WABA ID: ' + wabaId);

                // Subscribe the WABA to the app
                const subResp = await fetch('https://graph.facebook.com/v21.0/' + wabaId + '/subscribed_apps', {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + token }
                });
                const subData = await subResp.json();
                output.push('SUBSCRIBE RESULT: ' + JSON.stringify(subData));

                // Save WABA ID to database
                await s.from('whatsapp_credentials').update({ waba_id: wabaId }).eq('phone_number_id', '1017996884730043');
                output.push('WABA ID saved to database!');
            }
        }
    } catch (e) {
        output.push('Business ERROR: ' + e.message);
    }

    fs.writeFileSync('scripts/subscribe_waba.txt', output.join('\n'), 'utf8');
    console.log('Done - check scripts/subscribe_waba.txt');
}

main().catch(console.error);
