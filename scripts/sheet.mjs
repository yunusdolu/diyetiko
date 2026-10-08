// Contact sheets for review: node scripts/sheet.mjs <prefix> [cols=2] [perSheet=6] [scale=0.45]
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const sharp = require(
  require.resolve('sharp', { paths: [path.dirname(require.resolve('next/package.json'))] }),
);
const [prefix, colsArg = '2', perArg = '6', scaleArg = '0.45'] = process.argv.slice(2);
const dir = path.dirname(prefix);
const base = path.basename(prefix);
const files = readdirSync(dir)
  .filter((f) => f.startsWith(base) && f.endsWith('.png') && !f.includes('.sheet'))
  .sort()
  .map((f) => path.join(dir, f));
const cols = Number(colsArg),
  per = Number(perArg),
  scale = Number(scaleArg);
for (let s = 0; s * per < files.length; s++) {
  const group = files.slice(s * per, s * per + per);
  const metas = await Promise.all(group.map((f) => sharp(f).metadata()));
  const w = Math.round(metas[0].width * scale),
    h = Math.round(metas[0].height * scale);
  const rows = Math.ceil(group.length / cols);
  const gap = 8;
  const composite = await Promise.all(
    group.map(async (f, i) => ({
      input: await sharp(f).resize(w, h, { fit: 'contain', background: '#888' }).toBuffer(),
      left: (i % cols) * (w + gap),
      top: Math.floor(i / cols) * (h + gap),
    })),
  );
  const out = `${prefix}.sheet${s}.png`;
  await sharp({
    create: {
      width: cols * w + (cols - 1) * gap,
      height: rows * h + (rows - 1) * gap,
      channels: 3,
      background: '#666',
    },
  })
    .composite(composite)
    .png()
    .toFile(out);
  console.log(out, group.map((g) => path.basename(g)).join(' | '));
}
