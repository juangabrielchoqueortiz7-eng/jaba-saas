import { GoogleGenerativeAI } from '@google/generative-ai';

async function testModel(name: string) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: name });
        const result = await model.generateContent("Hola");
        console.log(`[SUCCESS] ${name} worked. Response length: ${result.response.text().length}`);
        return true;
    } catch (e: any) {
        console.log(`[FAIL] ${name}: ${e.message}`);
        return false;
    }
}

testModel('gemini-2.5-pro');
