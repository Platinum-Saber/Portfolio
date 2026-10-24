/**
 * Builds Raphael's web sprite set for /chibi-agent from the casual-coat image
 * pack her desktop overlay runs on (Chibi-Agent `svg-rig`, chibi_overlay/sprites.py).
 *
 * Run by hand with `node scripts/sync-raphael.mjs [packDir]`. The output is
 * committed: the pack lives on the author's D: drive, so CI can never see it.
 *
 * The pack's states and expressions are whole 1024 x 1536 redraws registered
 * to the neutral master, not layers. Shipping them whole would be ~2 MB, so
 * only the base is full-size and every other state ships as the patch where it
 * actually differs (measured once: blinks across the eyes, mouths in a 100 px
 * box, thinking over the face and one hand). Each patch gets a feathered edge,
 * as sprites.py does for mouths at runtime, so slight colour drift between
 * redraws never shows as a seam. `happy` changes the whole figure and is
 * skipped. Gaze follows the pack's own advice (gaze-map.json): only the two eye
 * rectangles are drawn over the fixed body.
 *
 * Writes public/images/raphael/{base,wave}.webp, patches/*.webp and
 * manifest.json (canvas-pixel rectangles; the page positions by percentage).
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PACK = process.argv[2] ?? 'D:/Character Design/output/assets/chibi/casual-coat/v01';
const OUT = path.resolve('public/images/raphael');
const MASTER = 'masters/coat-chibi-neutral-v1.png';
const WEBP = { quality: 86, alphaQuality: 100, effort: 6 };

// [x, y, w, h] in canvas px, from the diff measurement above, padded.
const EYES = [240, 400, 544, 320];
const MOUTH = [460, 650, 136, 136];
const FACE_HAND = [144, 336, 640, 512];
const PATCHES = {
  blink_half: ['states/blink_half.png', EYES],
  blink_closed: ['states/blink_closed.png', EYES],
  mouth_1: ['states/mouth_open_1.png', MOUTH],
  mouth_2: ['states/mouth_open_2.png', MOUTH],
  mouth_3: ['states/mouth_open_3.png', MOUTH],
  thinking: ['expressions/thinking.png', FACE_HAND],
};

const src = (f) => path.join(PACK, f);

/** A white rounded rectangle, blurred: multiplied into a patch's alpha so its edge fades out. */
function featherMask(w, h, edge) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <filter id="f"><feGaussianBlur stdDeviation="${edge / 2}"/></filter>
      <rect x="${edge}" y="${edge}" width="${w - 2 * edge}" height="${h - 2 * edge}" rx="${edge}" fill="#fff" filter="url(#f)"/>
    </svg>`,
  );
}

async function patch(file, [x, y, w, h], name, edge) {
  await sharp(src(file))
    .extract({ left: x, top: y, width: w, height: h })
    .ensureAlpha()
    .composite([{ input: featherMask(w, h, edge), blend: 'dest-in' }])
    .webp(WEBP)
    .toFile(path.join(OUT, 'patches', `${name}.webp`));
  return { src: `patches/${name}.webp`, x, y, w, h };
}

/** Lowest opaque row and the opaque columns' centre: how sprites.py lines poses up by the feet. */
async function feet(file) {
  const { data, info } = await sharp(src(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let bottom = 0, minX = info.width, maxX = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 32) {
        bottom = y;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
  }
  return { bottom, cx: (minX + maxX) / 2 };
}

await rm(OUT, { recursive: true, force: true });
await mkdir(path.join(OUT, 'patches'), { recursive: true });

const meta = await sharp(src(MASTER)).metadata();
await sharp(src(MASTER)).webp(WEBP).toFile(path.join(OUT, 'base.webp'));

const patches = {};
for (const [name, [file, rect]] of Object.entries(PATCHES)) {
  patches[name] = await patch(file, rect, name, name.startsWith('mouth') ? 18 : 28);
}

const gazeMap = JSON.parse(await readFile(src('gaze-map.json'), 'utf8'));
const rects = gazeMap.rendering.eye_rectangles_xywh;
const gaze = [];
for (const s of gazeMap.states) {
  if (s.name === 'center') continue;
  const eyes = [];
  for (const [i, r] of rects.entries()) eyes.push(await patch(s.file, r, `gaze_${s.name}_${i}`, 6));
  gaze.push({ name: s.name, x: s.x, y: s.y, eyes });
}

const [a, b] = [await feet(MASTER), await feet('poses/wave.png')];
await sharp(src('poses/wave.png')).webp(WEBP).toFile(path.join(OUT, 'wave.webp'));

const eyeCentre = [
  (rects[0][0] + rects[1][0] + rects[1][2]) / 2,
  (rects[0][1] + rects[0][3] / 2 + rects[1][1] + rects[1][3] / 2) / 2,
];
const manifest = {
  canvas: [meta.width, meta.height],
  base: 'base.webp',
  wave: { src: 'wave.webp', dx: a.cx - b.cx, dy: a.bottom - b.bottom },
  eyeCentre,
  deadzone: gazeMap.selection.center_deadzone,
  patches,
  gaze,
};
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`raphael: base + ${Object.keys(patches).length} patches + ${gaze.length} gaze directions -> ${OUT}`);
