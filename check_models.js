const fs = require('fs');
const https = require('https');

// Read .env.local to find GOOGLE_API_KEY
try {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const match = envContent.match(/GOOGLE_API_KEY=(.+)/);

    if (!match) {
        console.error("GOOGLE_API_KEY not found in .env.local");
        process.exit(1);
    }

    const apiKey = match[1].trim().replace(/["']/g, ''); // Clean quotes if present

    console.log("Checking models with API Key ending in...", apiKey.slice(-4));

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.error) {
                    console.error("API Error:", json.error);
                } else {
                    console.log("Available Models:");
                    if (json.models) {
                        json.models.forEach(m => {
                            if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
                                console.log(`- ${m.name} (${m.displayName})`);
                            }
                        });
                    } else {
                        console.log("No models returned (empty list).");
                        console.log(json);
                    }
                }
            } catch (e) {
                console.error("Error parsing JSON:", e);
                console.log("Raw Response:", data);
            }
        });
    }).on('error', (e) => {
        console.error("Request Error:", e);
    });

} catch (e) {
    console.error("Error reading .env.local:", e);
}
