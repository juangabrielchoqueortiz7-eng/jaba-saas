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

async function fixChat() {
    console.log("Fixing Chat Ownership...");

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

    // 2. Find Chat with NULL user_id
    const targetPhone = "59169344192";
    const { data: chat } = await supabase
        .from('chats')
        .select('id, user_id')
        .eq('phone_number', targetPhone)
        .single();

    if (!chat) {
        console.log("Chat not found.");
        return;
    }

    console.log(`Chat Found: ${chat.id}, Current UserID: ${chat.user_id}`);

    if (chat.user_id === tenantUserId) {
        console.log("Chat already has correct owner.");
        return;
    }

    // 3. Update Chat
    const { error } = await supabase
        .from('chats')
        .update({ user_id: tenantUserId })
        .eq('id', chat.id);

    if (error) {
        console.error("Error updating chat:", error);
    } else {
        console.log("SUCCESS: Chat ownership updated.");
    }
}

fixChat();
