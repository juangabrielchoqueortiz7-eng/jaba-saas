const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env vars
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("Missing Service Role Key. Cannot read DB.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentMessages() {
    console.log("Checking credentials in DB...");

    const { data: creds, error } = await supabase
        .from('whatsapp_credentials')
        .select('*');

    if (error) {
        console.error("Error fetching credentials:", error);
    } else {
        if (creds.length === 0) {
            console.log("No credentials found.");
        } else {
            creds.forEach(c => {
                console.log(`ID: ${c.id}`);
                console.log(`Phone ID: ${c.phone_number_id} (Type: ${typeof c.phone_number_id})`);
                console.log(`WABA ID: ${c.waba_id}`);
                console.log(`User ID: ${c.user_id}`);
                console.log(`Updated At: ${c.updated_at}`);
                console.log('---');
            });
        }
    }
}

checkRecentMessages();
