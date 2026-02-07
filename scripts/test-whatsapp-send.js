
// Standalone script to test WhatsApp sending


// Mocking environment variables for the script context since it runs outside of Next.js context mostly
// But wait, the previous script failed because of imports.
// src/lib/whatsapp.ts uses 'export async function', which is ESM.
// Node.js might complain if I use 'require' on a TS file or ESM file without transpilation.
// A better approach for a quick test script in this Next.js environment is to use a standalone JS file that fetches variables from .env.local manually or just valid hardcoded values for the TEST only, OR use `ts-node` if available.
// Given the previous trouble, I will make a standalone JS script that reimplements the fetch logic just for this test, reading the .env file.
// actually, I can just read the .env.local file in the script.

const fs = require('fs');
const path = require('path');
const https = require('https'); // or use fetch if node 18+

// Load env vars
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

// Re-implementing the logic here to avoid TS compilation issues for a simple script
async function testSend() {
    const token = process.env.WHATSAPP_API_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const to = '59169344192'; // User Provided Number Verified

    console.log("Token:", token ? "Found" : "Missing");
    console.log("Phone ID:", phoneNumberId);
    console.log("Sending to:", to);

    if (!token || !phoneNumberId) {
        console.error("Missing credentials");
        return;
    }

    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;
    const body = JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        text: { body: "Hola! Esta es una prueba de envío desde Jaba SaaS." },
    });

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: body,
        });

        const data = await response.json();
        console.log("Response Status:", response.status);
        console.log("Response Body:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

testSend();
