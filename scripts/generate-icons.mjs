// Renders the app logo SVG into every PWA icon size.
// Run: node scripts/generate-icons.mjs   (icons are committed, re-run only when the logo changes)
import sharp from 'sharp';
import fs from 'fs';

const src = 'public/icons/logo.svg';
const out = 'public/icons';
fs.mkdirSync(out, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
for (const size of sizes) {
    await sharp(src, { density: 300 }).resize(size, size).png().toFile(`${out}/icon-${size}x${size}.png`);
}

// Maskable: same logo scaled to the 80% safe zone on a solid brand ground
const inner = Math.round(512 * 0.72);
const logo = await sharp(src, { density: 300 }).resize(inner, inner).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#4f46e5' } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(`${out}/icon-maskable-512x512.png`);

fs.copyFileSync(`${out}/icon-180x180.png`, 'public/apple-touch-icon.png');
console.log('icons generated');
