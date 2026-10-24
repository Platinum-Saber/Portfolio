/**
 * Copies Raphael's Live2D rig (the Chibi-Agent desktop companion) from the
 * character-design workspace into `public/models/raphael/` for /chibi-agent.
 *
 * Run by hand with `node scripts/sync-raphael.mjs [sourceDir]`. The output is
 * committed: the source lives on the author's D: drive, so CI can never see it
 * (unlike `assets/raw/`, which `build-assets.mjs` rebuilds on every push).
 *
 * Only what the page plays is shipped - six motions and four expressions out
 * of eighteen and nine - and the 2048 atlas goes from a 2 MB PNG to WebP with
 * lossless alpha, because Cubism blends edges with the alpha channel and a
 * lossy one leaves a grey fringe around her hair.
 *
 * Her art is published here for portfolio display only (Chibi-Agent
 * docs/character.md). Her cloned voice is never published, so nothing audio is
 * copied, whatever the source folder holds.
 */
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE = process.argv[2] ?? 'D:/Character Design/output/runtime/chibi/robe';
const NAME = 'Raphael_chibi_robe_v21';
const OUT = path.resolve('public/models/raphael');
const MOTIONS = ['Idle', 'Think', 'Wave', 'Happy', 'Notice', 'LookAround'];
const EXPRESSIONS = ['neutral', 'happy', 'thinking', 'focused'];

const src = (...p) => path.join(SOURCE, ...p);
const model = JSON.parse(await readFile(src(`${NAME}.model3.json`), 'utf8'));

await rm(OUT, { recursive: true, force: true });
await mkdir(path.join(OUT, 'motions'), { recursive: true });
await mkdir(path.join(OUT, 'expressions'), { recursive: true });

await copyFile(src(`${NAME}.moc3`), path.join(OUT, 'raphael.moc3'));
await copyFile(src(`${NAME}.physics3.json`), path.join(OUT, 'raphael.physics3.json'));
await sharp(src(model.FileReferences.Textures[0]))
  .webp({ quality: 90, alphaQuality: 100, effort: 6 })
  .toFile(path.join(OUT, 'texture.webp'));

await writeFile(path.join(OUT, 'raphael.pose3.json'), JSON.stringify({ Type: 'Live2D Pose', Groups: [] }) + '\n');

const motions = {};
for (const name of MOTIONS) {
  await copyFile(src(`${NAME}.motions`, `${name}.motion3.json`), path.join(OUT, 'motions', `${name}.motion3.json`));
  motions[name] = [{ File: `motions/${name}.motion3.json` }];
}
const expressions = [];
for (const name of EXPRESSIONS) {
  await copyFile(src(`${NAME}.expressions`, `${name}.exp3.json`), path.join(OUT, 'expressions', `${name}.exp3.json`));
  expressions.push({ Name: name, File: `expressions/${name}.exp3.json` });
}

const out = {
  Version: model.Version,
  FileReferences: {
    Moc: 'raphael.moc3',
    Textures: ['texture.webp'],
    Physics: 'raphael.physics3.json',
    // The rig has no pose groups, but pixi-live2d-display requests a file named
    // "Pose" when none is declared: an empty pose keeps that from 404ing.
    Pose: 'raphael.pose3.json',
    Expressions: expressions,
    Motions: motions,
  },
  Groups: model.Groups,
  // Optional in the Cubism spec, but pixi-live2d-display's Cubism 5 model
  // calls `.map` on it unconditionally and dies without it.
  HitAreas: model.HitAreas ?? [],
};
await writeFile(path.join(OUT, 'raphael.model3.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`raphael: ${MOTIONS.length} motions, ${EXPRESSIONS.length} expressions -> ${OUT}`);
