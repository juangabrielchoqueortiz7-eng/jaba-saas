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

const token = "EAA8ZAkqZBNZBNoBQZBqJPVSaeBFvlb5wPZCA3vOfk6a7ZCInugc7dvTIEXc68NzZBdNVcGzaxSBmZC54JGARgeQbK7OTkzFK4fsYIS11fawdgpe4cBYFQxZCfAaHHmzfwwpVnJarNJ98mM2dI4oaw4iaw1ZCwxojLqUoqhVW3XsBx0tshBxJXuXAMtAQWOeFQmqdBiGwZDZD";
const phoneNumberId = "1017996884730043";

console.log(`Checking Phone ID: ${phoneNumberId}`);

async function checkPhoneId() {
    // Using v19.0 to be safe
    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating`;

    try {
        console.log(`Fetching: ${url}`);
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const text = await response.text();
        fs.writeFileSync('error_log.json', text);
        console.log("Written response to error_log.json");
    } catch (e) {
        console.error("Error checking Phone ID:", e);
    }
}

checkPhoneId();
