/**
 * Script para ejecutar la migración de la tabla de pedidos (orders)
 * Ejecutar: node scripts/run_migration.js
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Leer de .env.local
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

async function main() {
    const sqlPath = path.join(__dirname, '..', 'src', 'lib', 'schema_orders.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Ejecutando migración SQL...');

    // NOTA: Supabase JS SDK no permite ejecutar SQL arbitrario directamente por motivos de seguridad
    // a menos que uses una función RPC o la API de administración.
    // Usualmente esto se hace via Dashboard o CLI.
    // Intentaremos usar rpc si existe o simplemente informaremos al usuario.

    console.log('--- SQL A EJECUTAR ---');
    console.log(sql);
    console.log('----------------------');
    console.log('\nPor favor, copia y pega el SQL de arriba en el SQL Editor de Supabase Dashboard.');
    console.log('O si tienes habilitado el acceso remoto, usa psql.');
}

main().catch(console.error);
