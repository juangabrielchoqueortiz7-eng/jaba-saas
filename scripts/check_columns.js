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

async function checkColumns() {
    console.log("Checking CHATS Table Columns...");

    // Select one row to see keys
    const { data, error } = await supabase
        .from('chats')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error", error);
    } else if (data && data.length > 0) {
        console.log("Columns found:", Object.keys(data[0]));
    } else {
        console.log("Table empty, checking error on invalid insert...");
        // Try inserting 'name' which likely doesn't exist
        const { error: insertError } = await supabase
            .from('chats')
            .insert({ phone_number: '000000', name: 'test' });

        if (insertError) {
            console.log("Insert Error:", insertError.message);
        }
    }
}

checkColumns();
