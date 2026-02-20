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
const wabaId = "1439379724456162";

console.log(`Creating Template 'jaba_welcome' for WABA ID: ${wabaId}`);

async function createTemplate() {
    const url = `https://graph.facebook.com/v22.0/${wabaId}/message_templates`;

    const body = {
        name: "jaba_utility",
        category: "UTILITY",
        components: [
            {
                type: "BODY",
                text: "Confirmación de sistema Jaba SaaS: Tu cuenta está conectada."
            }
        ],
        language: "es"
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log("Response Status:", response.status);
        console.log("Response Body:", JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log("SUCCESS: Template Created!");
        } else {
            console.error("Template Creation Failed.");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

createTemplate();
