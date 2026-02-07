// Usando fetch nativo de Node.js

async function sendTestMessage() {
    const url = 'http://localhost:3000/api/webhook';

    const payload = {
        object: 'whatsapp_business_account',
        entry: [{
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                        display_phone_number: '1234567890',
                        phone_number_id: 'PHONE_NUMBER_ID'
                    },
                    contacts: [{
                        profile: {
                            name: "Test User"
                        },
                        wa_id: "1234567890" // User's phone number
                    }],
                    messages: [{
                        from: "1234567890", // User's phone number
                        id: "wamid.HBgLMTIzNDU2Nzg5MA==",
                        timestamp: Math.floor(Date.now() / 1000).toString(),
                        text: {
                            body: "Hola, esto es una prueba desde el script local!"
                        },
                        type: "text"
                    }]
                },
                field: 'messages'
            }]
        }]
    };

    try {
        console.log('Enviando mensaje de prueba a:', url);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response:', text);
    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
    }
}

sendTestMessage();
