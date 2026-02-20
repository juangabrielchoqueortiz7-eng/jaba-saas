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
// WABA ID found in user screenshot
const wabaId = "1439379724456162";

console.log(`Listing Templates for WABA ID: ${wabaId}`);

async function listTemplates() {
    const url = `https://graph.facebook.com/v22.0/${wabaId}/message_templates?limit=10`;

    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Error fetching templates:", JSON.stringify(data, null, 2));
        } else {
            console.log("Templates found:");
            data.data.forEach(t => {
                console.log(`- Name: ${t.name} | Status: ${t.status} | Language: ${t.language}`);
            });
            // Write to file for full inspection
            fs.writeFileSync('templates_log.json', JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

listTemplates();
