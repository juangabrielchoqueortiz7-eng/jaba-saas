async function sendTestMessage() {
    // URL LOCAL (Para probar los cambios recientes en route.ts)
    const url = 'http://localhost:3000/api/webhook';

    const payload = {
        object: 'whatsapp_business_account',
        entry: [{
            id: '1439379724456162', // WABA ID
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                        display_phone_number: '59169344192',
                        phone_number_id: '1017996884730043' // NEW Phone Number ID
                    },
                    contacts: [{
                        profile: {
                            name: "Test User"
                        },
                        wa_id: "59167193341" // User's personal number (simulated sender)
                    }],
                    messages: [{
                        from: "59167193341",
                        id: "wamid.TEST_MESSAGE_ID_" + Date.now(),
                        timestamp: Math.floor(Date.now() / 1000).toString(),
                        text: {
                            body: "Hola, prueba de webhook local para nuevo asistente."
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
        // Nota: Esto requiere Node 18+ para fetch nativo
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
