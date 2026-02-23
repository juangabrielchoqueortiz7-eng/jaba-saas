const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('id, name, qr_image_url')
        .eq('is_active', true);

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    console.log('Products:', JSON.stringify(data, null, 2));
}

listProducts();
