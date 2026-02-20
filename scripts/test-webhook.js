async function sendTestMessage() {
    // URL DE PRODUCCIÓN (Para verificar el deploy)
    const url = 'https://jaba-saas.vercel.app/api/webhook';

    const payload = {
        object: 'whatsapp_business_account',
        entry: [{
            id: '1439379724456162', // WABA ID
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                        display_phone_number: "1234567890",
                        phone_number_id: "1017996884730043" // ID REAL DE TU BASE DE DATOS
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
        try {
            const json = JSON.parse(text);
            if (json.error) {
                console.log('RESULT: FAILURE');
                console.log('ERROR CODE:', json.error);
                console.log('DEBUG KEY:', json.debug_key_present);
                console.log('DEBUG PHONE:', json.debug_phone_id);
            } else {
                console.log('RESULT: SUCCESS');
            }
        } catch (e) {
            console.log('Response Text:', text);
        }
        console.log('Response Text:', text);
    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
    }
}

sendTestMessage();
