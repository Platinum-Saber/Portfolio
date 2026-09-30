/**
 * Which bodies of the FYP quad's CAD belong to which /lab component - the
 * third argument to obj-to-glb.mjs:
 *
 *   node scripts/obj-to-glb.mjs <Drone_5_2205.obj> assets/raw/fyp-drone.glb scripts/fyp-drone.parts.mjs
 *
 * The Fusion export names its bodies Body1, Body1:2, ... so nothing in the
 * file says what a body IS. These rules say it from where each body sits and
 * what it is made of. They are checked in order against every body's bounding
 * box; the first match wins, and a body nothing matches (screws, wiring, the
 * antenna) belongs to no component and simply fades with the rest.
 *
 * Coordinates are the CAD's own, as exported: centimetres, +Y toward the nose
 * (the Gemini 336), and +Z pointing DOWN in flight - so "above the top plate"
 * is z < 0 and the flight-controller stack under the bottom plate is z > 2.9.
 *
 * Part ids are the `id`s in src/lib/drone.ts. Re-check these if the CAD
 * changes: the converter prints each part's triangle count and extent.
 */

/** Motor axes, from the prop hubs. */
const HUBS = [
  [8.6, 7.2],
  [8.6, -6.9],
  [-8.6, 7.2],
  [-8.6, -6.9],
];

/** The props are split out as rotors before any rule runs; this is their part. */
export const ROTOR_PART = 'motors';

export const PARTS = [
  'compute',
  'depth-camera',
  'frame',
  'motors',
  'power',
  'flight-controller',
];

export function classify({ materials, min, max }) {
  const c = min.map((v, i) => (v + max[i]) / 2);
  const size = max.map((v, i) => v - min[i]);
  const [x, y, z] = c;
  const long = Math.max(size[0], size[1]);

  // Printed Nylon 12 is the ducts; the black carbon sheet is plates and arms.
  if (materials.some((m) => /nylon/i.test(m))) return 'frame';
  if (materials.includes('Opaque(25,25,25)') && long > 3) return 'frame';
  // The Gemini 336 bar across the nose.
  if (y > 7.9 && Math.abs(x) < 5 && z > -0.5 && z < 2) return 'depth-camera';
  // Stator, bell and mount: small bodies on a motor axis.
  if (long < 4 && HUBS.some(([hx, hy]) => Math.hypot(x - hx, y - hy) < 2.2)) return 'motors';
  // The 30 x 30 mm stack under the bottom plate.
  if (Math.abs(x) < 2.2 && Math.abs(y) < 2.2 && z > 2.9) return 'flight-controller';
  // The pack on top, aft of the compute stack.
  if (y < -2 && z < 0 && Math.abs(x) < 2.5) return 'power';
  // Orin Nano module, carrier, heatsink and fan, above the top plate.
  if (Math.abs(x) < 5.5 && y > -2.7 && y < 6.8 && z < 0) return 'compute';
  return null;
}
