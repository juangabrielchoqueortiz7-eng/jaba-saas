const https = require('https');
const fs = require('fs');
const path = require('path');

// Load env vars manually
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

const token = process.env.WHATSAPP_API_TOKEN;
// WABA ID from user screenshot
const wabaId = "885864024334077";

console.log(`Checking WABA ID: ${wabaId}`);

async function checkWaba() {
    const url = `https://graph.facebook.com/v19.0/${wabaId}/phone_numbers?fields=id,display_phone_number`;

    try {
        console.log(`Fetching: ${url}`);
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const text = await response.text();
        fs.writeFileSync('waba_log.json', text);
        console.log("Written response to waba_log.json");
    } catch (e) {
        console.error("Error checking WABA:", e);
    }
}

checkWaba();
