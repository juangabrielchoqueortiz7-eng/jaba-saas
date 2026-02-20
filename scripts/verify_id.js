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
// Use Service Role Key to bypass RLS and see ALL messages
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyId() {
    console.log("Verifying ID...");
    const targetId = "1017996884730043"; // The one we expect

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
                console.log(`Stored ID: "${c.phone_number_id}"`);
                console.log(`Target ID: "${targetId}"`);
                console.log(`Match? ${c.phone_number_id === targetId}`);
                console.log(`Stored Length: ${c.phone_number_id.length}`);
                console.log(`Target Length: ${targetId.length}`);
                for (let i = 0; i < c.phone_number_id.length; i++) {
                    console.log(`Char ${i}: ${c.phone_number_id.charCodeAt(i)}`);
                }
            });
        }
    }
}

verifyId();
