/**
 * Script para subir las imágenes QR a Supabase Storage
 * Ejecutar: node scripts/upload_qr.js
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Leer de .env.local si no están en ENV
let envVars = {};
try {
    const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val.length) envVars[key.trim()] = val.join('=').trim();
    });
} catch (e) { }

const url = SUPABASE_URL || envVars.NEXT_PUBLIC_SUPABASE_URL;
const key = SUPABASE_SERVICE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('ERROR: Falta SUPABASE_URL o SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(url, key);

const BUCKET = 'sales-assets';
const QR_DIR = path.join(__dirname, '..', 'public', 'qr');

const qrFiles = [
    { file: 'qr_1m.jpg', name: 'qr/qr_1m.jpg' },
    { file: 'qr_3m.jpg', name: 'qr/qr_3m.jpg' },
    { file: 'qr_6m.jpg', name: 'qr/qr_6m.jpg' },
    { file: 'qr_9m.jpg', name: 'qr/qr_9m.jpg' },
    { file: 'qr_1y.jpg', name: 'qr/qr_1y.jpg' },
];

async function main() {
    // 1. Crear bucket si no existe
    console.log(`Verificando bucket "${BUCKET}"...`);
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET);

    if (!exists) {
        console.log(`Creando bucket "${BUCKET}"...`);
        const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
        if (error) {
            console.error('Error creando bucket:', error.message);
            process.exit(1);
        }
        console.log('Bucket creado ✅');
    } else {
        console.log('Bucket ya existe ✅');
    }

    // 2. Subir cada QR
    for (const qr of qrFiles) {
        const filePath = path.join(QR_DIR, qr.file);

        if (!fs.existsSync(filePath)) {
            console.log(`⚠️ Archivo no encontrado: ${qr.file}`);
            continue;
        }

        const fileBuffer = fs.readFileSync(filePath);
        console.log(`Subiendo ${qr.file} (${(fileBuffer.length / 1024).toFixed(0)} KB)...`);

        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(qr.name, fileBuffer, {
                contentType: 'image/jpeg',
                upsert: true  // Sobrescribir si ya existe
            });

        if (error) {
            console.error(`Error subiendo ${qr.file}:`, error.message);
        } else {
            const { data: { publicUrl } } = supabase.storage
                .from(BUCKET)
                .getPublicUrl(qr.name);
            console.log(`✅ ${qr.file} → ${publicUrl}`);
        }
    }

    console.log('\n🎉 Subida completada!');
}

main().catch(console.error);
