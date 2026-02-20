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
// Use Service Role Key to simulate Webhook Admin Client
const supabaseKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugNewClient() {
    console.log("--- DEBUGGING NEW CLIENT CREATION ---");

    // 1. Tenant Lookup (Known Good)
    const targetPhoneId = "1017996884730043";
    const { data: creds } = await supabase
        .from('whatsapp_credentials')
        .select('user_id')
        .eq('phone_number_id', targetPhoneId)
        .single();

    if (!creds) { console.error("Tenant Credentials NOT FOUND"); return; }
    const tenantUserId = creds.user_id;
    console.log(`Tenant User ID: ${tenantUserId}`);

    // 2. Simulate NEW Client
    const newPhoneNumber = "59199998888"; // Random new number
    const contactName = "Cliente Nuevo Test"; // Name from WhatsApp
    const messageText = "Hola, soy un cliente nuevo";

    // 3. Attempt Insert (Replicating route.ts logic)
    console.log(`Attempting to INSERT chat for ${newPhoneNumber}...`);

    // Check if exists first (cleanup from previous runs)
    const { data: existing } = await supabase.from('chats').select('id').eq('phone_number', newPhoneNumber).single();
    if (existing) {
        console.log("Cleanup: Deleting existing test chat...");
        await supabase.from('chats').delete().eq('id', existing.id);
    }

    const { data: newChat, error: chatError } = await supabase.from('chats').insert({
        phone_number: newPhoneNumber,
        user_id: tenantUserId,
        contact_name: contactName, // Logic fixed in Step 1136
        last_message: messageText,
        unread_count: 1
        // status: 'active' // REMOVED in Step 1136
    }).select().single();

    if (chatError) {
        console.error("❌ INSERT CHAT ERROR:", JSON.stringify(chatError, null, 2));
        return;
    }
    console.log("✅ Chat Created:", newChat.id);

    // 4. Attempt Message Insert
    console.log("Attempting to INSERT message...");
    const { data: msg, error: msgError } = await supabase.from('messages').insert({
        chat_id: newChat.id,
        is_from_me: false, // User sent this
        content: messageText,
        status: 'delivered'
        // type: 'text' // REMOVED in Step 1091
    }).select().single();

    if (msgError) {
        console.error("❌ INSERT MESSAGE ERROR:", JSON.stringify(msgError, null, 2));
    } else {
        console.log("✅ Message Saved:", msg.id);
    }
}

debugNewClient();
