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
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const pin = "123456"; // Default PIN for initial registration

console.log(`Registering Phone ID: ${phoneNumberId} with PIN: ${pin}`);

async function registerPhone() {
    const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/register`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                pin: pin
            })
        });

        const data = await response.json();
        console.log("Response Status:", response.status);
        console.log("Response Body:", JSON.stringify(data, null, 2));

        if (!response.ok) {
            console.error("Registration Failed.");
        } else {
            console.log("SUCCESS: Phone Number Registered!");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

registerPhone();
