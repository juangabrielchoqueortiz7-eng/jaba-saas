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

    const serviceKey = keys['SUPABASE_SERVICE_ROLE_KEY'];

    if (serviceKey) {
        console.log(`Local Service Key Length: ${serviceKey.length}`);
        console.log(`Local Service Key Start: ${serviceKey.substring(0, 10)}`);
        console.log(`Local Service Key End: ${serviceKey.substring(serviceKey.length - 10)}`);
    } else {
        console.log("Local Service Key NOT FOUND");
    }

} catch (e) {
    console.error("Error reading .env.local", e);
}
