/**
 * Script de diagnóstico para verificar el estado del pedido y el QR
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer de .env.local
let envVars = {};
try {
    const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length) envVars[key.trim()] = val.join('=').trim();
    });
} catch (e) { }

const url = envVars.NEXT_PUBLIC_SUPABASE_URL;
const key = envVars.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function checkDiagnostics() {
    const phone = '59162449491'; // Número del usuario en el screenshot

    console.log(`Buscando pedidos para: ${phone}...`);

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('phone_number', phone)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error buscando pedidos:', error);
        return;
    }

    if (!orders || orders.length === 0) {
        console.log('No se encontraron pedidos para este número.');
        return;
    }

    console.log('--- PEDIDOS ENCONTRADOS ---');
    orders.forEach(order => {
        console.log(`ID: ${order.id}`);
        console.log(`Plan: ${order.plan_name} (${order.plan})`);
        console.log(`Monto: ${order.amount}`);
        console.log(`Email: ${order.customer_email || 'PENDIENTE'}`);
        console.log(`Estado: ${order.status}`);
        console.log(`Creado: ${order.created_at}`);
        console.log('---------------------------');

        if (order.status === 'pending_delivery') {
            console.log('✅ El pedido avanzó a pending_delivery. El QR debió intentarse enviar.');
        }
    });

    // Verificar si los archivos QR existen en el bucket
    console.log('\nVerificando archivos en el bucket "sales-assets"...');
    const { data: files, error: storageError } = await supabase.storage
        .from('sales-assets')
        .list('qr');

    if (storageError) {
        console.error('Error listando storage:', storageError);
    } else {
        console.log('Archivos encontrados:', files.map(f => f.name));

        // Generar una URL de prueba para el plan de 3m (Bronce) que es el del screenshot
        const testPlan = '3m';
        const fileName = 'qr_3m.jpg';
        const publicUrl = `${url}/storage/v1/object/public/sales-assets/qr/${fileName}`;
        console.log(`\nURL Generada para prueba (3 meses): ${publicUrl}`);

        // Intentar un fetch a esa URL para ver si es accesible
        try {
            console.log(`Haciendo fetch a la URL de prueba...`);
            const resp = await fetch(publicUrl, { method: 'HEAD' });
            console.log(`Estado de la respuesta: ${resp.status} ${resp.statusText}`);
            if (!resp.ok) {
                console.log('⚠️ LA URL NO PARECE SER PÚBLICA O EL ARCHIVO NO EXISTE.');
            } else {
                console.log('✅ URL accesible públicamente.');
            }
        } catch (e) {
            console.error('Error haciendo fetch:', e.message);
        }
    }
}

checkDiagnostics().catch(console.error);
