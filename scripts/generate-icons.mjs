import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const src = path.join(root, 'imagebatida.jpg');

async function ensureExists(file) {
  try {
    await fs.access(file);
  } catch {
    throw new Error(`Source image not found: ${file}`);
  }
}

async function writeIcon(input, size, outPath) {
  const dir = path.dirname(outPath);
  await fs.mkdir(dir, { recursive: true });
  await input
    .clone()
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(outPath);
}

async function main() {
  await ensureExists(src);
  const input = sharp(src).rotate();

  const legacy = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
  };

  const foreground = {
    'mipmap-mdpi': 108,
    'mipmap-hdpi': 162,
    'mipmap-xhdpi': 216,
    'mipmap-xxhdpi': 324,
    'mipmap-xxxhdpi': 432,
  };

  for (const [bucket, size] of Object.entries(legacy)) {
    const base = path.join(root, 'android', 'app', 'src', 'main', 'res', bucket);
    await writeIcon(input, size, path.join(base, 'ic_launcher.png'));
    await writeIcon(input, size, path.join(base, 'ic_launcher_round.png'));
  }

  for (const [bucket, size] of Object.entries(foreground)) {
    const base = path.join(root, 'android', 'app', 'src', 'main', 'res', bucket);
    await writeIcon(input, size, path.join(base, 'ic_launcher_foreground.png'));
  }

  await writeIcon(input, 16, path.join(root, 'public', 'favicon-16x16.png'));
  await writeIcon(input, 32, path.join(root, 'public', 'favicon-32x32.png'));
  await writeIcon(input, 180, path.join(root, 'public', 'apple-touch-icon.png'));
  await writeIcon(input, 192, path.join(root, 'public', 'icon-192.png'));
  await writeIcon(input, 512, path.join(root, 'public', 'icon-512.png'));
  await writeIcon(input, 256, path.join(root, 'public', 'favicon.png'));

  console.log('Icon generation completed from imagebatida.jpg');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
