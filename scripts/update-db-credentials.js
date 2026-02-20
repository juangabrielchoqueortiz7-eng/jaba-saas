const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env vars manually
try {
    const envPath = path.resolve(__dirname, '../.env.local');
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
} catch (e) {
    console.error("Error reading .env.local", e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Note: In a real backend script we'd use SERVICE_ROLE_KEY to bypass RLS, 
// but here we might need to rely on the user being logged in OR just use the service role if available in env.
// Let's check if we have a service role key in .env.local (usually named SUPABASE_SERVICE_ROLE_KEY)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.error("No Service Role Key found. Cannot bypass RLS to update records.");
    // Prompt user or try to find it? 
    // Actually, for this local script to work on RLS protected tables without a user session, we NEED the service role key.
    // Let's check .env.local content via `grep` first? No, I alrady read it earlier.
    // Wait, step 10 showed .env.local. Let me check if it has the service role key.
    // It has: # Project API Keys -> service_role (secret) (Úsalo solo en el servidor)
    // NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=... (Wait, usually it's SUPABASE_SERVICE_ROLE_KEY)
    // Let's assume the script finds it if I map it correctly.
}

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

const newPhoneNumberId = "1017996884730043";
const newWabaId = "1439379724456162";
const newAccessToken = "EAA8ZAkqZBNZBNoBQ4bBocW2T8VXCLawHJlRhNZChYeKyyYn5MxRdJg5EtUcsZCFvO3dpmCps0T6X4c1qY098DH5vDUDZCKXJMSZAZAyFZCSCyvK5UORVoH10wD28rhRDQL7ZBrwobDtr1X5ONvZBu9wFtUue12zDki2S3LAJNLklIpOBO15IbPrYF92znpNUCLF5xneGgZDZD";

async function updateCredentials() {
    console.log("Updating credentials...");

    // We don't know the exact user_id, but there's likely only one user or we update ALL for this dev setup?
    // Safer: List users/credentials first.

    const { data: credentials, error: fetchError } = await supabase
        .from('whatsapp_credentials')
        .select('*');

    if (fetchError) {
        console.error("Error fetching credentials:", fetchError);
        return;
    }

    console.log(`Found ${credentials.length} credential records.`);

    if (credentials.length === 0) {
        console.log("No credentials found. You might need to 'Create' an assistant first via the UI.");
        return;
    }

    // Update the first one found (assuming single user dev env)
    const targetId = credentials[0].id;
    console.log(`Updating record ID: ${targetId}`);

    const { error: updateError } = await supabase
        .from('whatsapp_credentials')
        .update({
            phone_number_id: newPhoneNumberId,
            waba_id: newWabaId,
            access_token: newAccessToken,
            phone_number_display: "+591 69344192", // Based on user info
            updated_at: new Date().toISOString()
        })
        .eq('id', targetId);

    if (updateError) {
        console.error("Error updating:", updateError);
    } else {
        console.log("SUCCESS: Credentials updated in Database!");
    }
}

updateCredentials();
