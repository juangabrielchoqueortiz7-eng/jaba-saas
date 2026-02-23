import * as fs from 'fs';

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`);
        const data = await response.json();
        const models = data.models
            .filter((m: any) => m.name.includes('gemini') && m.name.includes('pro'))
            .map((m: any) => m.name)
            .join('\n');

        fs.writeFileSync('models_utf8.txt', models, { encoding: 'utf8' });
    } catch (e) {
        console.error(e);
    }
}
listModels();
