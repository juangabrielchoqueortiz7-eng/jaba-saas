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

async function checkChats() {
    console.log("Checking Chats & Credentials...");

    // 1. Get Tenant User ID
    const targetPhoneId = "1017996884730043";
    const { data: creds } = await supabase
        .from('whatsapp_credentials')
        .select('user_id, phone_number_id')
        .eq('phone_number_id', targetPhoneId)
        .single();

    if (creds) {
        console.log(`Tenant User ID (from creds): ${creds.user_id}`);
    } else {
        console.log("Tenant Credentials NOT FOUND");
    }

    // 2. Check Chats
    const targetPhone = "59169344192";
    const { data: chats, error } = await supabase
        .from('chats')
        .select('*')
        .eq('phone_number', targetPhone);

    if (error) {
        console.error("Error fetching chats:", error);
    } else {
        if (chats.length === 0) {
            console.log("No chats found.");
        } else {
            chats.forEach(c => {
                console.log(`--- CHAT FOUND ---`);
                console.log(`ID: ${c.id}`);
                console.log(`User ID (on chat): ${c.user_id}`);
                console.log(`Match? ${creds && c.user_id === creds.user_id}`);
                console.log(`Last Msg: ${c.last_message}`);
            });
        }
    }
}

checkChats();
