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
    console.log("Checking Messages Table Columns...");

    // Hack to check columns by selecting an empty row and looking at keys
    // or by checking the error message when selecting a non-existent column
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error", error);
    } else if (data && data.length > 0) {
        console.log("Columns found:", Object.keys(data[0]));
    } else {
        console.log("Table empty, can't infer columns easily from data.");
        // Try inserting a dummy row with 'sender' to see error
        const { error: insertError } = await supabase
            .from('messages')
            .insert({ chat_id: '00000000-0000-0000-0000-000000000000', sender: 'test' }); // Invalid UUID to ensure failure but trigger column check

        if (insertError) {
            console.log("Insert Error (Expect 'Column does not exist'):", insertError.message);
        }
    }
}

checkColumns();
