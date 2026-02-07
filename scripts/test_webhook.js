// Native fetch used


const WEBHOOK_URL = 'https://jaba-saas.vercel.app/api/webhook';
const MOCK_PAYLOAD = {
    object: 'whatsapp_business_account',
    entry: [{
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [{
            value: {
                messaging_product: 'whatsapp',
                metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: '1234567890'
                },
                contacts: [{
                    profile: { name: 'Juan Perez' },
                    wa_id: '59177777777'
                }],
                messages: [{
                    from: '59177777777', // Simulated Phone
                    id: 'wamid.HBgLM...',
                    timestamp: Date.now() / 1000,
                    text: { body: 'Mensaje de Prueba desde Script' },
                    type: 'text'
                }]
            },
            field: 'messages'
        }]
    }]
};

async function testWebhook() {
    console.log('Enviando mensaje simulado a:', WEBHOOK_URL);
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(MOCK_PAYLOAD)
        });

        console.log('Status Code:', response.status);
        const text = await response.text();
        console.log('Response:', text);

        if (response.status === 200) {
            console.log('✅ ÉXITO: El servidor aceptó el mensaje. Revisa el Dashboard.');
        } else {
            console.log('❌ ERROR: El servidor rechazó el mensaje.');
        }
    } catch (error) {
        console.error('❌ ERROR DE CONEXIÓN:', error.message);
    }
}

testWebhook();
