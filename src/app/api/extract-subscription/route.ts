import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');

export async function POST(req: NextRequest) {
    if (!apiKey) {
        return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('image') as File;

        if (!file) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString('base64');

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        const prompt = `
            Analyze this image (screenshot of a payment, chat, or subscription details).
            Extract the following information if visible:
            1. Email address (correo)
            2. Phone number (whatsapp/numero) - Extract digits only
            3. Expiration date (vencimiento) - Return in DD/MM/YYYY format. If the image says "1 month", "1 year", etc., calculate it starting from today (${new Date().toLocaleDateString('es-ES')}).
            
            Return ONLY a valid JSON object with these keys: "correo", "numero", "vencimiento".
            If a field is not found, return null for that field.
            Example: { "correo": "test@mail.com", "numero": "59170000000", "vencimiento": "12/03/2026" }
        `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: file.type
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        // Clean markdown code blocks if present
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const data = JSON.parse(cleanText);

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Error extracting subscription data:', error);
        return NextResponse.json({ error: error.message || 'Failed to process image' }, { status: 500 });
    }
}
