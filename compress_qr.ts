import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const dir = path.join(process.cwd(), 'public', 'qr');

async function compress() {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg'));

    for (const file of files) {
        const filePath = path.join(dir, file);
        const outPath = path.join(dir, `compressed_${file}`);

        console.log(`Comprimiendo ${file}...`);
        await sharp(filePath)
            .resize(1200) // ancho máximo 1200px
            .jpeg({ quality: 80 }) // compresión 80%
            .toFile(outPath);

        // Rename compressed to original
        fs.unlinkSync(filePath);
        fs.renameSync(outPath, filePath);
        console.log(`✅ ${file} comprimido.`);
    }
}

compress().catch(console.error);
