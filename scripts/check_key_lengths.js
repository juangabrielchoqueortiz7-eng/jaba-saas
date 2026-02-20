const fs = require('fs');
const path = require('path');

try {
    const envPath = path.resolve(__dirname, '../.env.local');
    const envConfig = fs.readFileSync(envPath, 'utf8');
    const keys = {};
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            keys[key.trim()] = value.trim();
        }
    });

    const anonKey = keys['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
    const serviceKey = keys['SUPABASE_SERVICE_ROLE_KEY'];

    console.log('--- EXPECTED LENGTHS ---');
    console.log(`Anon Key Length: ${anonKey ? anonKey.length : 'MISSING'}`);
    console.log(`Service Key Length: ${serviceKey ? serviceKey.length : 'MISSING'}`);

} catch (e) {
    console.error("Error reading .env.local", e);
}
