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
// Mimic route.ts logic for key
const supabaseKey = process.env.JABA_ADMIN_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugInsertIncoming() {
    console.log("Attempting to Insert INCOMING Message...");

    // 1. Get Chat ID (We know it exists from previous steps)
    const targetPhone = "59167193341"; // The one my script created
    const { data: chat } = await supabase
        .from('chats')
        .select('id')
        .eq('phone_number', targetPhone)
        .single();

    if (!chat) {
        console.error("Chat not found!");
        return;
    }
    const chatId = chat.id;
    console.log(`Chat ID: ${chatId}`);

    // 2. Insert Incoming Message (is_from_me: false)
    const messageText = "Test INCOMING from Script (is_from_me: false)";

    const { data, error } = await supabase
        .from('messages')
        .insert({
            chat_id: chatId,
            is_from_me: false, // This is the boolean
            content: messageText,
            status: 'delivered'
        })
        .select()
        .single();

    if (error) {
        console.error("INSERT ERROR:", error);
    } else {
        console.log("INSERT SUCCESS:", data);
    }
}

debugInsertIncoming();
