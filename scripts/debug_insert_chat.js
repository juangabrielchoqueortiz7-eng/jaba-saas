const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugInsert() {
    console.log("Attempting to Insert Chat...");

    // 1. Get Tenant User ID
    const targetPhoneId = "1017996884730043";
    const { data: creds } = await supabase
        .from('whatsapp_credentials')
        .select('user_id')
        .eq('phone_number_id', targetPhoneId)
        .single();

    if (!creds) {
        console.error("Credentials not found!");
        return;
    }
    const tenantUserId = creds.user_id;
    console.log(`Tenant User ID: ${tenantUserId}`);

    // 2. Mock Data (Matches User's Real Number)
    const phoneNumber = "59167193341"; // User's number
    const contactName = "Real User Debug Local";
    const messageText = "Test Insert from Script";

    // 3. Try Insert
    const { data, error } = await supabase
        .from('chats')
        .insert({
            phone_number: phoneNumber,
            user_id: tenantUserId,
            contact_name: contactName, // Schema says 'contact_name', route.ts uses 'name'?!
            // Wait, schema_chats.sql says 'contact_name'. route.ts used 'name'.
            // If route.ts sends 'name' and column doesn't exist, it fails?
            last_message: messageText,
            unread_count: 1,
            // status: 'active' // Does status column exist? schema_chats.sql didn't show it in CREATE TABLE usually.
        })
        .select()
        .single();

    if (error) {
        console.error("INSERT ERROR:", error);
    } else {
        console.log("INSERT SUCCESS:", data);
    }
}

debugInsert();
