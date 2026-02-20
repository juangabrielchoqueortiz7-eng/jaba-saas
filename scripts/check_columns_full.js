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

    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error", error);
    } else if (data && data.length > 0) {
        console.log("--- COLUMNS ---");
        Object.keys(data[0]).forEach(col => console.log(col));
        console.log("---------------");
    } else {
        console.log("Table empty. Trying to insert to find columns...");
        // This won't work well if we don't know columns.
        // Let's rely on the previous method but print cleanly.
    }
}

checkColumns();
