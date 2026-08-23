/**
 * Phase 3 — the asset pipeline.
 *
 * Takes the untouched files in `assets/raw/` and emits web-ready GLBs into
 * `public/models/`. Run it with `npm run assets:build`; CI runs the same
 * command on any push that touches `assets/raw/`, so the committed output and
 * the raw input can never drift apart.
 *
 * ── Two profiles ────────────────────────────────────────────────────────────
 * `schematic` throws appearance away entirely: textures, materials and every
 * vertex attribute except POSITION. The scene redraws it unlit at low opacity
 * with its hard edges picked out, which is the language `/lab` and the explore
 * world are already drawn in. Scenery uses this.
 *
 * `interior` is `pbr` with one difference that matters enormously: it does NOT
 * merge meshes. The lab's objects have to stay individually addressable so the
 * scene can find the control panel, the door, the tank and the cabinet and
 * hang behaviour on them. Merging would save draw calls and destroy the whole
 * interaction.
 *
 * `pbr` keeps the material as authored — base colour, normal and
 * metallic-roughness — because the craft you fly is a machined metal object
 * and reading as metal is most of what makes it convincing.
 *
 * That choice is what puts the lighting rig in `explore/Scene.tsx`. A metal
 * surface reflects its surroundings and emits nothing of its own, so a
 * metallic material with no environment map renders very nearly black no
 * matter how many lamps you point at it. The scene therefore generates an
 * environment from three's procedural `RoomEnvironment` — code, not a
 * downloaded HDR, so this costs no bytes on the wire. Lights, PBR materials
 * and that environment are one decision: remove any of them and the craft
 * turns black or flat.
 *
 * TANGENT is still dropped. three derives tangents in the shader when the
 * attribute is absent, which is fine for normal mapping at this scale and
 * saves a full vec4 per vertex.
 *
 * ── Texture format: WebP, not KTX2 — measured, not assumed ─────────────────
 * KTX2/Basis is the textbook answer for GPU memory: a 512² map stays
 * compressed in VRAM instead of expanding to 1 MB of RGBA. It was tried
 * properly on the lab — UASTC for normal maps, ETC1S for everything else,
 * KTX-Software 4.3.2 — and it lost:
 *
 *   WebP @512, all maps   2.53 MB on the wire, ~95 MB VRAM
 *   KTX2 (UASTC + ETC1S)  5.92 MB on the wire, ~12 MB VRAM
 *
 * 2.3x the download, because UASTC normal maps are large and the KTX2 step
 * decodes EXT_meshopt_compression on the way through, forfeiting the geometry
 * win. 5.92 MB alone would breach the 5 MB total 3D payload budget. It also
 * needs a `toktx` binary in CI and a ~250 KB transcoder on the render path.
 *
 * So the lever for VRAM here is fewer maps, not a different codec: dropping
 * normal and metallic-roughness takes the lab from ~95 MB to ~54 MB. That is
 * the fallback if the Android pass shows memory pressure — one edit to the
 * profile, no new toolchain.
 *
 * ── Why the output is aggressively simplified ──────────────────────────────
 * These are generated meshes in the hundreds of thousands of triangles. Two
 * independent reasons to cut them down hard:
 *   1. Schematic meshes get an EdgesGeometry built on the CPU at load. On a
 *      raw mesh that is a multi-second main-thread stall on a phone.
 *   2. At full density the edge pass renders as a hairball — every crease in a
 *      generated mesh becomes a line, and the silhouette disappears into
 *      noise. Simplification is a legibility requirement, not only a
 *      performance one.
 */

import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
} from '@gltf-transform/extensions';
import {
  dedup,
  flatten,
  join as joinMeshes,
  prune,
  quantize,
  simplify,
  textureCompress,
  weld,
} from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * One entry per raw asset. `targetTriangles` is a budget, not a ratio, so the
 * number stays meaningful if a source is re-exported at a different density.
 */
const ASSETS = [
  {
    src: 'assets/raw/lab.glb',
    out: 'public/models/lab.glb',
    profile: 'interior',
    /**
     * A 14 x 4 x 8 m room you fly around slowly and look at closely, so this
     * is the largest budget here. Measured: 179k source triangles reduce to
     * ~91k with no visible loss at the distances you actually see it from.
     */
    targetTriangles: 90000,
    /**
     * 512 rather than 1024. The source ships 110 maps and VRAM, not bytes, is
     * the binding constraint indoors: 1024 costs ~380 MB of texture memory
     * against ~95 MB at 512, and no mid-range phone has the former to spare.
     * KTX2 was measured as the alternative and rejected — see the header note.
     */
    textureSize: 512,
  },
  {
    src: 'assets/raw/vt-802.glb',
    out: 'public/models/vt-802.glb',
    profile: 'pbr',
    /**
     * The craft you fly, and the only object on screen a visitor looks at
     * directly. Higher than scenery would get: welded UV and normal seams stop
     * the simplifier collapsing a textured mesh as far anyway, and asking for
     * less only distorts the map and facets the shell.
     */
    targetTriangles: 12000,
    textureSize: 1024,
  },
  {
    src: 'assets/raw/city.glb',
    out: 'public/models/city.glb',
    /**
     * Authored `KHR_materials_unlit`, which is why it belongs here rather than
     * in the schematic profile: three builds it a `MeshBasicMaterial` by
     * itself, so it keeps its own colour and ignores the craft's lighting rig
     * exactly as the rest of the world does. Nothing to convert.
     */
    profile: 'pbr',
    /** Already lean. The budget is its own count — simplify is a no-op. */
    targetTriangles: 2616,
    textureSize: 512,
  },
  {
    src: 'assets/raw/quadcopter.glb',
    out: 'public/models/quadcopter.glb',
    profile: 'schematic',
    /**
     * Scenery, parked, and read at distance. Low enough that the CPU-side
     * EdgesGeometry build is imperceptible on a phone.
     */
    targetTriangles: 5000,
  },
];

/** Everything a schematic render ignores. `pbr` keeps NORMAL and TEXCOORD_0. */
const UNUSED_ATTRIBUTES = [
  'NORMAL',
  'TANGENT',
  'TEXCOORD_0',
  'TEXCOORD_1',
  'TEXCOORD_2',
  'TEXCOORD_3',
  'COLOR_0',
];

/** Kept by the `pbr` profile. TANGENT is not: three derives it in the shader. */
const PBR_ATTRIBUTES = ['NORMAL', 'TEXCOORD_0'];

function countTriangles(document) {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const position = primitive.getAttribute('POSITION');
      const count = indices
        ? indices.getCount()
        : position
          ? position.getCount()
          : 0;
      total += count / 3;
    }
  }
  return Math.round(total);
}

function textureBytes(document) {
  return document
    .getRoot()
    .listTextures()
    .reduce((sum, texture) => sum + (texture.getImage()?.byteLength ?? 0), 0);
}

function dropAttributes(document, names) {
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      for (const name of names) {
        if (primitive.getAttribute(name)) primitive.setAttribute(name, null);
      }
    }
  }
}

/**
 * Schematic: delete appearance outright. Done before simplify so the
 * simplifier is not asked to preserve UV seams that nothing samples — seam
 * preservation is exactly what stops a mesh reaching a low triangle budget.
 */
function stripAppearance(document) {
  for (const texture of document.getRoot().listTextures()) texture.dispose();
  dropAttributes(document, UNUSED_ATTRIBUTES);

  // Materials are overridden at runtime anyway; collapsing them to one keeps
  // the draw calls mergeable in `join`.
  const [keep, ...rest] = document.getRoot().listMaterials();
  if (!keep) return;
  keep.setName('schematic');
  for (const material of rest) {
    for (const parent of material.listParents()) {
      if (parent.propertyType === 'Primitive') parent.setMaterial(keep);
    }
    material.dispose();
  }
}

/**
 * PBR: keep the material intact and shed only the vertex attributes three does
 * not need. Nothing is removed from the appearance here — that is the point of
 * the profile.
 */
function keepMaterials(document) {
  dropAttributes(
    document,
    UNUSED_ATTRIBUTES.filter((name) => !PBR_ATTRIBUTES.includes(name)),
  );
}

async function build(io, asset) {
  const srcPath = join(ROOT, asset.src);
  const outPath = join(ROOT, asset.out);
  const textured = asset.profile === 'pbr' || asset.profile === 'interior';
  // Interiors keep their meshes separate so objects stay addressable by
  // material name. Everything else merges for the draw-call saving.
  const merge = asset.profile !== 'interior';

  const document = await io.read(srcPath);
  const before = {
    bytes: statSync(srcPath).size,
    triangles: countTriangles(document),
    textureBytes: textureBytes(document),
  };

  if (textured) keepMaterials(document);
  else stripAppearance(document);

  await document.transform(
    // flatten + join first: the sources arrive as deep node hierarchies of
    // small primitives, and the simplifier works per-primitive. Merging first
    // means it optimises across the whole airframe instead of many times in
    // isolation, which is what lets the budget go this low.
    ...(merge
      ? [flatten(), dedup(), joinMeshes({ keepNamed: false })]
      : [dedup()]),
    // Generated meshes are unwelded — vertices are duplicated per triangle, so
    // the simplifier sees no shared edges and can collapse nothing at all.
    // This single call is the difference between 500k triangles out and 6k.
    weld({ tolerance: 0.0001 }),
    simplify({
      simplifier: MeshoptSimplifier,
      ratio: Math.min(1, asset.targetTriangles / Math.max(1, before.triangles)),
      // Generous for schematic, where silhouette is all that survives into an
      // edge render; tighter for textured, where collapsing across a UV seam
      // smears the map.
      error: textured ? 0.005 : 0.02,
      lockBorder: textured,
    }),
    prune(),
    // 14-bit positions are ~1 mm over a 2 m craft — far below anything visible
    // and it halves the vertex buffer.
    // Normals need enough bits that a smooth shell does not band under a
    // specular highlight; positions and UVs can be coarser.
    quantize({
      quantizePosition: 14,
      quantizeTexcoord: 12,
      quantizeNormal: 10,
    }),
    ...(textured
      ? [
          textureCompress({
            encoder: sharp,
            targetFormat: 'webp',
            resize: [asset.textureSize, asset.textureSize],
            quality: 82,
          }),
        ]
      : []),
  );

  await MeshoptEncoder.ready;
  document
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({
      method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
    });

  mkdirSync(dirname(outPath), { recursive: true });
  const glb = await io.writeBinary(document);
  writeFileSync(outPath, glb);

  return {
    name: asset.out,
    profile: asset.profile,
    before,
    after: {
      bytes: glb.byteLength,
      triangles: countTriangles(document),
      textureBytes: textureBytes(document),
    },
  };
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': null,
  });

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

const results = [];
for (const asset of ASSETS) results.push(await build(io, asset));

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const pct = (a, b) => `${(100 - (b / a) * 100).toFixed(1)}%`;

console.log(
  '\nasset              profile     raw        built     saved     triangles          textures',
);
console.log('─'.repeat(96));
for (const r of results) {
  console.log(
    `${r.name.replace('public/models/', '').padEnd(18)} ${r.profile.padEnd(10)} ${kb(
      r.before.bytes,
    ).padStart(9)} ${kb(r.after.bytes).padStart(9)}  ${pct(
      r.before.bytes,
      r.after.bytes,
    ).padStart(7)}  ${String(r.before.triangles).padStart(7)} → ${String(
      r.after.triangles,
    ).padEnd(7)}  ${kb(r.before.textureBytes)} → ${kb(r.after.textureBytes)}`,
  );
}
console.log('');

writeFileSync(
  join(ROOT, 'public/models/manifest.json'),
  JSON.stringify(
    { builtAt: new Date().toISOString(), assets: results },
    null,
    2,
  ) + '\n',
);
