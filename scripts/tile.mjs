// Split a tall screenshot into tiles for review: node scripts/tile.mjs file.png [tileHeight] [scale]
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const sharpPath = require.resolve('sharp', {
  paths: [path.dirname(require.resolve('next/package.json'))],
});
const sharp = require(sharpPath);
const [file, th = '1800', sc = '0.6'] = process.argv.slice(2);
const img = sharp(file);
const { width, height } = await img.metadata();
const tileH = Number(th);
for (let y = 0, i = 0; y < height; y += tileH, i++) {
  const h = Math.min(tileH, height - y);
  const out = file.replace(/\.png$/, `.t${String(i).padStart(2, '0')}.png`);
  await sharp(file)
    .extract({ left: 0, top: y, width, height: h })
    .resize(Math.round(width * Number(sc)))
    .toFile(out);
  console.log(out);
}
