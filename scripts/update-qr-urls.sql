-- Script to update products with correct QR URLs from public/qr
-- Assuming the base URL is the app URL

-- First, let's see what we have
SELECT id, name, qr_image_url FROM products;

-- Update URLs (Base URL will be handled in the code or here)
-- For now, let's use relative paths or placeholders that the webhook will resolve

UPDATE products 
SET qr_image_url = 'qr/qr_1m.jpg' 
WHERE name ILIKE '%1 Mes%' OR name ILIKE '%Básico%';

UPDATE products 
SET qr_image_url = 'qr/qr_3m.jpg' 
WHERE name ILIKE '%3 Meses%' OR name ILIKE '%Bronce%';

UPDATE products 
SET qr_image_url = 'qr/qr_6m.jpg' 
WHERE name ILIKE '%6 Meses%' OR name ILIKE '%Plata%';

UPDATE products 
SET qr_image_url = 'qr/qr_9m.jpg' 
WHERE name ILIKE '%9 Meses%' OR name ILIKE '%Gold%';

UPDATE products 
SET qr_image_url = 'qr/qr_1y.jpg' 
WHERE name ILIKE '%1 Año%' OR name ILIKE '%Premium%';
