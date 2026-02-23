import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadVideo() {
    const filePath = path.join(process.cwd(), 'public', 'tutorial.mp4');
    console.log("Subiendo archivo:", filePath);

    if (!fs.existsSync(filePath)) {
        console.error("Archivo no encontrado");
        return;
    }

    const fileBuffer = fs.readFileSync(filePath);

    // Upload to 'sales-assets' bucket
    const { data, error } = await supabase.storage
        .from('sales-assets')
        .upload('tutorial.mp4', fileBuffer, {
            contentType: 'video/mp4',
            upsert: true
        });

    if (error) {
        console.error("Error al subir a Supabase Storage:", error.message);
    } else {
        console.log("Subida exitosa:", data);
        const { data: publicUrl } = supabase.storage.from('sales-assets').getPublicUrl('tutorial.mp4');
        console.log("URL Pública:", publicUrl.publicUrl);
    }
}

uploadVideo();
