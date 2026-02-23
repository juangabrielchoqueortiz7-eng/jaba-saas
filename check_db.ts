import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    const { data: products, error } = await supabaseAdmin.from('products').select('*');
    if (error) console.error(error);
    else fs.writeFileSync('db_out.json', JSON.stringify(products, null, 2));
}

check();
