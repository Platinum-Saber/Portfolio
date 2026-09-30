/**
 * CAD export (OBJ + MTL) → a raw GLB for `assets/raw/`.
 *
 *   node scripts/obj-to-glb.mjs <path/to/model.obj> assets/raw/fyp-drone.glb [parts.mjs]
 *
 * Exists because Fusion / Autodesk exporters do not write glTF, and the
 * pipeline in build-assets.mjs only reads it. This is a one-off import step,
 * run by hand when the CAD changes - NOT part of `assets:build` or CI, because
 * the source (229 MB for the FYP quad) is far too large to live in git. The
 * GLB this writes is the committed "raw" source from then on.
 *
 * What it does, in order, and why:
 *
 * 1. Axis and units. CAD exports are Z-up in centimetres; glTF is Y-up in
 *    metres. (x, y, z) → (x, z, -y) · 0.01. For the FYP quad this also puts the
 *    nose (the Gemini 336, on +Y in CAD) along -Z, which is the direction both
 *    flight models fly - so no rotation is needed where it is rendered.
 *
 *    UPSIDE_DOWN: the quad is modelled with CAD +Z pointing DOWN in flight
 *    (Suhan, 2026-09-30). The flip is a half-turn about the nose axis -
 *    (x, y, z) → (-x, -z, -y) · 0.01 - so the nose stays on -Z. Baked in here
 *    rather than rotated in the component because the prop spin direction in
 *    the extras depends on which way is up, and the two must not disagree.
 *
 * 2. Materials are merged by colour. Fusion writes one material per
 *    appearance - 83 of them on the quad, most a slightly different grey on a
 *    screw or a connector. Every material survives build-assets.mjs as its own
 *    draw call, and the lab is already near its ~40 budget. At the size the
 *    craft is drawn, (192,192,192) and (203,203,203) are the same colour.
 *    Materials closer than MERGE_DISTANCE merge; ones covering less than
 *    MIN_AREA_SHARE of the surface fold into their nearest neighbour. Area,
 *    not triangle count: a finely tessellated connector has thousands of
 *    triangles and is still invisible at 40 cm.
 *
 * 3. Rotors are kept as their own named nodes (any OBJ group matching
 *    ROTOR_PATTERN), each with its geometry centred on its hub and the hub
 *    recorded in the node's extras as `spinPivot`. build-assets.mjs keeps named
 *    nodes out of `join`, and PbrModel turns anything with a `spinPivot`. The
 *    pivot has to travel as data: `quantize` rewrites the node transform, so
 *    the node's own origin is not the hub by the time it reaches the browser.
 *
 * 4. Decimated HERE, to roughly the final budget, with the CAD normals thrown
 *    away first and rebuilt afterwards. This is the non-obvious part. CAD
 *    normals are split at every hard edge, and meshopt will not collapse
 *    across an attribute seam - with them kept, the quad floored at ~290k
 *    triangles whatever budget or error was asked for. Without them it goes
 *    to ~30k with no visible change. So: drop normals → weld → simplify →
 *    rebuild normals with a crease angle (smooth across a cylinder, sharp at
 *    a machined edge). build-assets.mjs then has nothing left to take - the
 *    asset's `targetTriangles` there is its own count, like city.glb's.
 *
 *    That also keeps assets/raw small: a faithful GLB of the export is
 *    ~45 MB, in plain git that is already near GitHub's limits (see
 *    docs/PLAN.md Phase 3).
 *
 * 5. Optional components (third argument, e.g. scripts/fyp-drone.parts.mjs).
 *    A module that says which CAD bodies make up which named component. Each
 *    component becomes a node `part-<id>` with `extras.part = id`, so /lab can
 *    light one up and fade the rest; rotors get the module's ROTOR_PART. The
 *    tag rides through weld and simplify as a `_PART` vertex attribute - so
 *    decimation is exactly what it would be without it - and the split
 *    happens after. build-assets.mjs decides per asset whether those nodes
 *    survive `join` (see `keepNodes` there).
 */

import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const [, , SRC, OUT, PARTS_MODULE] = process.argv;
if (!SRC || !OUT) {
  console.error('usage: node scripts/obj-to-glb.mjs <model.obj> <out.glb> [parts.mjs]');
  process.exit(1);
}
const parts = PARTS_MODULE
  ? await import(pathToFileURL(resolvePath(PARTS_MODULE)).href)
  : null;

const UNIT = 0.01; // cm → m
const UPSIDE_DOWN = true; // see note 1
const FLIP = UPSIDE_DOWN ? -1 : 1;
const ROTOR_PATTERN = /prop/i;
const MERGE_DISTANCE = 64; // sRGB 0-255 Euclidean
/** Share of total surface area below which a colour folds into its neighbour. */
const MIN_AREA_SHARE = 0.03;
const TARGET_TRIANGLES = 30000;
/**
 * Relative to each primitive's extent (~0.33 m here), so 0.006 is ~2 mm - far
 * under a pixel at the size the craft is drawn. Borders are not locked: CAD
 * bodies are closed, so there are none worth protecting.
 */
const SIMPLIFY_ERROR = 0.006;
/** Faces meeting at more than this are drawn as a hard edge. */
const CREASE_DEGREES = 35;

/** Appearance names Fusion uses that are not plain painted plastic. */
function surface(name) {
  if (/steel|alum|metal|titan/i.test(name)) return { metallic: 1, roughness: 0.35 };
  if (/glass/i.test(name)) return { metallic: 0, roughness: 0.05 };
  if (/glossy/i.test(name)) return { metallic: 0, roughness: 0.3 };
  return { metallic: 0, roughness: 0.6 };
}

// ── MTL ─────────────────────────────────────────────────────────────────────
const mtl = {};
{
  const text = readFileSync(join(dirname(SRC), readMtllib(SRC)), 'utf8');
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const [key, ...rest] = line.trim().split(/\s+/);
    if (key === 'newmtl') current = mtl[rest.join(' ')] = { kd: [0.8, 0.8, 0.8] };
    else if (key === 'Kd' && current) current.kd = rest.map(Number);
  }
}

function readMtllib(path) {
  // The mtllib line is in the first few lines; no need to scan 229 MB for it.
  const head = readFileSync(path, { encoding: 'utf8', flag: 'r' }).slice(0, 4096);
  const match = head.match(/^mtllib\s+(.+)$/m);
  return match ? match[1].trim() : path.replace(/\.obj$/i, '.mtl');
}

// ── OBJ ─────────────────────────────────────────────────────────────────────
class Grow {
  constructor(Type) { this.Type = Type; this.a = new Type(1 << 16); this.n = 0; }
  push(...xs) {
    if (this.n + xs.length > this.a.length) {
      const b = new this.Type(this.a.length * 2); b.set(this.a); this.a = b;
    }
    for (const x of xs) this.a[this.n++] = x;
  }
  get array() { return this.a.subarray(0, this.n); }
}

const V = new Grow(Float32Array);
/** bucket key → flat [v, group, v, group, ...] per triangle corner, 0-based. */
const buckets = new Map();
const area = {}; // material → surface area, for merging
let group = '';
let material = '';
/** Per OBJ group (a CAD body): its extent in the CAD's own axes and units. */
const groups = [{ name: '', materials: new Set(), min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }];
const RAW = new Grow(Float32Array);

const rl = createInterface({ input: createReadStream(SRC), crlfDelay: Infinity });
for await (const line of rl) {
  const c0 = line.charCodeAt(0);
  if (c0 === 118 /* v */) {
    const p = line.split(/\s+/);
    // Axis + unit conversion happens here, once, for every consumer.
    if (p[0] === 'v') {
      V.push(FLIP * +p[1] * UNIT, FLIP * +p[3] * UNIT, -p[2] * UNIT);
      RAW.push(+p[1], +p[2], +p[3]);
    }
    // `vn` is deliberately ignored - see note 4 at the top.
  } else if (c0 === 102 /* f */) {
    const p = line.trim().split(/\s+/);
    const corners = [];
    for (let i = 1; i < p.length; i++) {
      const v = p[i].split('/')[0];
      const vi = +v < 0 ? V.n / 3 + +v : +v - 1;
      corners.push(vi, groups.length - 1);
      const g = groups[groups.length - 1];
      for (let k = 0; k < 3; k++) {
        const r = RAW.a[3 * vi + k];
        if (r < g.min[k]) g.min[k] = r;
        if (r > g.max[k]) g.max[k] = r;
      }
      g.materials.add(material);
    }
    const key = ROTOR_PATTERN.test(group) ? `rotor:${group}` : `mat:${material}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { material, list: new Grow(Int32Array) }));
    for (let i = 1; i + 1 < corners.length / 2; i++) {
      b.list.push(corners[0], corners[1], corners[2 * i], corners[2 * i + 1], corners[2 * i + 2], corners[2 * i + 3]);
      if (!key.startsWith('rotor:')) {
        area[material] = (area[material] ?? 0) + triangleArea(corners[0], corners[2 * i], corners[2 * i + 2]);
      }
    }
  } else if (line.startsWith('g ') || line.startsWith('o ')) {
    group = line.slice(2).trim();
    groups.push({ name: group, materials: new Set(), min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
  } else if (line.startsWith('usemtl ')) {
    material = line.slice(7).trim();
  }
}
const positions = V.array;

function triangleArea(a, b, c) {
  const p = V.a;
  const ux = p[3 * b] - p[3 * a], uy = p[3 * b + 1] - p[3 * a + 1], uz = p[3 * b + 2] - p[3 * a + 2];
  const vx = p[3 * c] - p[3 * a], vy = p[3 * c + 1] - p[3 * a + 1], vz = p[3 * c + 2] - p[3 * a + 2];
  return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

// ── Material merge ──────────────────────────────────────────────────────────
const rgb = (name) => (mtl[name]?.kd ?? [0.8, 0.8, 0.8]).map((x) => x * 255);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const isSpecial = (name) => surface(name).metallic === 1;

const byArea = Object.keys(area).sort((a, b) => area[b] - area[a]);
const totalArea = byArea.reduce((s, name) => s + area[name], 0);
const kept = []; // { name, rgb, area, special }
const target = {}; // source material → kept entry
for (const name of byArea) {
  const special = isSpecial(name);
  const near = kept
    .filter((k) => k.special === special)
    .map((k) => [k, dist(k.rgb, rgb(name))])
    .sort((a, b) => a[1] - b[1])[0];
  if (near && near[1] < MERGE_DISTANCE) {
    target[name] = near[0];
    near[0].area += area[name];
  } else {
    const k = { name, rgb: rgb(name), area: area[name], special };
    kept.push(k);
    target[name] = k;
  }
}
// Fold slivers into the nearest substantial colour.
const big = kept.filter((k) => k.area >= MIN_AREA_SHARE * totalArea || k.special);
for (const k of kept) {
  if (big.includes(k)) continue;
  const near = big
    .filter((b) => !b.special)
    .map((b) => [b, dist(b.rgb, k.rgb)])
    .sort((a, b) => a[1] - b[1])[0][0];
  for (const [name, t] of Object.entries(target)) if (t === k) target[name] = near;
  near.area += k.area;
}

// ── Document ────────────────────────────────────────────────────────────────
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('drone');
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const materials = new Map();
function materialFor(entry) {
  if (!materials.has(entry)) {
    const s = surface(entry.name);
    const [r, g, b] = entry.rgb.map((x) => srgbToLinear(x / 255));
    materials.set(
      entry,
      doc
        .createMaterial(entry.name)
        .setBaseColorFactor([r, g, b, 1])
        .setMetallicFactor(s.metallic)
        .setRoughnessFactor(s.roughness),
    );
  }
  return materials.get(entry);
}

/**
 * Part index per OBJ group: 0 for none, else 1 + position in parts.PARTS.
 * Classified once, from each body's full extent.
 */
const groupPart = groups.map((g) => {
  if (!parts || !isFinite(g.min[0])) return 0;
  const id = parts.classify({ name: g.name, materials: [...g.materials], min: g.min, max: g.max });
  return id ? parts.PARTS.indexOf(id) + 1 : 0;
});

/** Indexed, position-only primitive from corner pairs, tagged `_PART` when parts are on. */
function primitive(lists, offset = [0, 0, 0]) {
  const remap = new Map();
  const pos = new Grow(Float32Array);
  const part = new Grow(Float32Array);
  const idx = new Grow(Uint32Array);
  for (const list of lists) {
    for (let i = 0; i < list.length; i += 2) {
      const v = list[i];
      let at = remap.get(v);
      if (at === undefined) {
        at = remap.size;
        remap.set(v, at);
        pos.push(positions[3 * v] - offset[0], positions[3 * v + 1] - offset[1], positions[3 * v + 2] - offset[2]);
        part.push(groupPart[list[i + 1]]);
      }
      idx.push(at);
    }
  }
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos.array.slice()).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx.array.slice()).setBuffer(buffer));
  if (parts) prim.setAttribute('_PART', doc.createAccessor().setType('SCALAR').setArray(part.array.slice()).setBuffer(buffer));
  return prim;
}

// Body: one unnamed mesh, one primitive per merged colour. Unnamed on purpose
// so `join` in build-assets.mjs is free to merge it.
const body = doc.createMesh();
const perEntry = new Map();
for (const [key, b] of buckets) {
  if (!key.startsWith('mat:')) continue;
  const entry = target[b.material];
  if (!perEntry.has(entry)) perEntry.set(entry, []);
  perEntry.get(entry).push(b.list.array);
}
for (const [entry, lists] of perEntry) body.addPrimitive(primitive(lists).setMaterial(materialFor(entry)));
scene.addChild(doc.createNode().setMesh(body));

// Rotors: one named node each, geometry centred on the hub.
/** Mean shift toward the densest round feature - the hub bore, for a prop. */
function hubOf(list) {
  const seen = new Set();
  const pts = [];
  for (let i = 0; i < list.length; i += 2) {
    const v = list[i];
    if (seen.has(v)) continue;
    seen.add(v);
    pts.push([positions[3 * v], positions[3 * v + 1], positions[3 * v + 2]]);
  }
  let c = [0, 0, 0];
  for (const p of pts) for (let k = 0; k < 3; k++) c[k] += p[k] / pts.length;
  // Horizontal only: the axis is vertical, so the pivot's height is irrelevant
  // to the spin and is left at the vertex mean.
  for (const radius of [0.02, 0.012, 0.008, 0.008, 0.008]) {
    let sx = 0, sz = 0, n = 0;
    for (const p of pts) {
      if (Math.hypot(p[0] - c[0], p[2] - c[2]) < radius) { sx += p[0]; sz += p[2]; n++; }
    }
    if (n) { c[0] = sx / n; c[2] = sz / n; }
  }
  return c;
}

let rotorIndex = 0;
const rotorEntries = {};
for (const [key, b] of buckets) {
  if (!key.startsWith('rotor:')) continue;
  const list = b.list.array;
  const hub = hubOf(list);
  const entry = rotorEntries[b.material] ??= { name: b.material, rgb: rgb(b.material), area: 0, special: false };
  const mesh = doc.createMesh(`rotor-${++rotorIndex}`).addPrimitive(primitive([list], hub).setMaterial(materialFor(entry)));
  scene.addChild(
    doc
      .createNode(`rotor-${rotorIndex}`)
      .setMesh(mesh)
      .setTranslation(hub)
      // All four props on this quad are the same CW part. -1 is clockwise
      // seen from above (a negative turn about +Y); flipping the model over
      // makes a CW part turn the other way as seen from its new top.
      .setExtras({
        spinPivot: hub,
        spinDirection: (/ccw/i.test(key) ? 1 : -1) * FLIP,
        ...(parts ? { part: parts.ROTOR_PART } : {}),
      }),
  );
}

// ── Decimation, then normals ────────────────────────────────────────────────
/**
 * Rebuilds a primitive with crease-angle normals: each corner averages the
 * area-weighted normals of the faces round its vertex that lie within
 * CREASE_DEGREES of its own face, and corners that land on the same normal
 * share a vertex. Smooth across a motor bell, sharp along a frame edge.
 */
function creaseNormals(prim) {
  const pos = prim.getAttribute('POSITION').getArray();
  const idx = prim.getIndices().getArray();
  const faces = idx.length / 3;
  const fn = new Float32Array(faces * 3); // area-weighted
  const fu = new Float32Array(faces * 3); // unit
  const incident = Array.from({ length: pos.length / 3 }, () => []);
  for (let f = 0; f < faces; f++) {
    const [a, b, c] = [idx[3 * f], idx[3 * f + 1], idx[3 * f + 2]];
    const ux = pos[3 * b] - pos[3 * a], uy = pos[3 * b + 1] - pos[3 * a + 1], uz = pos[3 * b + 2] - pos[3 * a + 2];
    const vx = pos[3 * c] - pos[3 * a], vy = pos[3 * c + 1] - pos[3 * a + 1], vz = pos[3 * c + 2] - pos[3 * a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    fn.set([nx, ny, nz], 3 * f);
    fu.set([nx / len, ny / len, nz / len], 3 * f);
    incident[a].push(f); incident[b].push(f); incident[c].push(f);
  }
  const cos = Math.cos((CREASE_DEGREES * Math.PI) / 180);
  const outPos = new Grow(Float32Array);
  const outNor = new Grow(Float32Array);
  const outIdx = new Grow(Uint32Array);
  const shared = new Map();
  for (let f = 0; f < faces; f++) {
    for (let k = 0; k < 3; k++) {
      const v = idx[3 * f + k];
      let x = 0, y = 0, z = 0;
      for (const g of incident[v]) {
        const d = fu[3 * f] * fu[3 * g] + fu[3 * f + 1] * fu[3 * g + 1] + fu[3 * f + 2] * fu[3 * g + 2];
        if (d >= cos) { x += fn[3 * g]; y += fn[3 * g + 1]; z += fn[3 * g + 2]; }
      }
      const len = Math.hypot(x, y, z) || 1;
      x /= len; y /= len; z /= len;
      const key = `${v}|${Math.round(x * 512)},${Math.round(y * 512)},${Math.round(z * 512)}`;
      let at = shared.get(key);
      if (at === undefined) {
        at = shared.size;
        shared.set(key, at);
        outPos.push(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]);
        outNor.push(x, y, z);
      }
      outIdx.push(at);
    }
  }
  prim.getAttribute('POSITION').setArray(outPos.array.slice());
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(outNor.array.slice()).setBuffer(buffer));
  prim.getIndices().setArray(outIdx.array.slice());
}

const count = () =>
  doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((s, p) => s + p.getIndices().getCount() / 3, 0);
const before = count();
await MeshoptSimplifier.ready;
await doc.transform(
  weld({ tolerance: 0.0001 }),
  simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, TARGET_TRIANGLES / before), error: SIMPLIFY_ERROR, lockBorder: false }),
  prune(),
);
/**
 * Moves each body triangle into its component's node, by the `_PART` tag of
 * its first vertex (a CAD body is one component, so its vertices agree), and
 * drops the tag. Untagged triangles stay in the unnamed body mesh.
 */
function splitParts() {
  const partMeshes = new Map();
  for (const prim of body.listPrimitives()) {
    const tag = prim.getAttribute('_PART');
    if (!tag) continue;
    const t = tag.getArray();
    const pos = prim.getAttribute('POSITION').getArray();
    const idx = prim.getIndices().getArray();
    const byPart = new Map();
    for (let f = 0; f < idx.length; f += 3) {
      const p = t[idx[f]];
      if (!byPart.has(p)) byPart.set(p, []);
      byPart.get(p).push(idx[f], idx[f + 1], idx[f + 2]);
    }
    for (const [p, tris] of byPart) {
      const remap = new Map();
      const outPos = new Grow(Float32Array);
      const outIdx = new Grow(Uint32Array);
      for (const v of tris) {
        let at = remap.get(v);
        if (at === undefined) {
          at = remap.size;
          remap.set(v, at);
          outPos.push(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]);
        }
        outIdx.push(at);
      }
      const piece = doc
        .createPrimitive()
        .setMaterial(prim.getMaterial())
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(outPos.array.slice()).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(outIdx.array.slice()).setBuffer(buffer));
      if (p === 0) {
        body.addPrimitive(piece);
        continue;
      }
      const id = parts.PARTS[p - 1];
      if (!partMeshes.has(id)) {
        const mesh = doc.createMesh(`part-${id}`);
        partMeshes.set(id, mesh);
        scene.addChild(doc.createNode(`part-${id}`).setMesh(mesh).setExtras({ part: id }));
      }
      partMeshes.get(id).addPrimitive(piece);
    }
    body.removePrimitive(prim);
    prim.dispose();
  }
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) prim.setAttribute('_PART', null);
  }
}
if (parts) splitParts();

for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) creaseNormals(prim);
await doc.transform(prune());

const glb = await new NodeIO().writeBinary(doc);
writeFileSync(OUT, glb);
console.log(
  `${SRC}\n  ${Object.keys(mtl).length} materials → ${materials.size}, ${rotorIndex} rotors` +
    `\n  ${Math.round(before)} → ${Math.round(count())} triangles, ${(glb.byteLength / 1048576).toFixed(2)} MB → ${OUT}`,
);
for (const m of doc.getRoot().listMaterials()) {
  const c = m.getBaseColorFactor().slice(0, 3).map((x) => Math.round((x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055) * 255));
  console.log(`    ${m.getName().padEnd(44)} rgb(${c.join(',')}) metal ${m.getMetallicFactor()}`);
}
for (const n of doc.getRoot().listNodes()) {
  if (!n.getName()) continue;
  const tris = n.getMesh().listPrimitives().reduce((s, p) => s + p.getIndices().getCount() / 3, 0);
  const pivot = n.getExtras().spinPivot;
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of n.getMesh().listPrimitives()) {
    const a = p.getAttribute('POSITION').getArray();
    for (let i = 0; i < a.length; i++) { const k = i % 3; lo[k] = Math.min(lo[k], a[i]); hi[k] = Math.max(hi[k], a[i]); }
  }
  const t = n.getTranslation();
  const ext = lo.map((v, k) => `${((v + t[k]) * 100).toFixed(1)}..${((hi[k] + t[k]) * 100).toFixed(1)}`).join(' ');
  console.log(`    ${n.getName().padEnd(24)} ${String(tris).padStart(6)} tris  cm ${ext}${pivot ? '  (spins)' : ''}`);
}
{
  const tris = body.listPrimitives().reduce((s, p) => s + p.getIndices().getCount() / 3, 0);
  console.log(`    ${'(no component)'.padEnd(24)} ${String(tris).padStart(6)} tris`);
}
