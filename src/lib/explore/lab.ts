/**
 * The lab: room geometry, colliders and stations.
 *
 * Everything here is measured off `assets/raw/lab.glb` rather than guessed —
 * the numbers came from walking the glTF and reading each node's world-space
 * bounding box. If the model is ever re-exported, re-measure; nothing in this
 * file can detect that the room moved underneath it.
 *
 * ── Why objects are addressed by MATERIAL name ─────────────────────────────
 * The source's node names are `Object_2` … `Object_30`, which say nothing. Its
 * *material* names are descriptive (in Polish, from the original author):
 * `Panel_sterowania` is the control panel, `drzwi` the door, `szafka_body` the
 * tall cabinet, `rura_gwna_baza` the central tank. Every mesh in the file has
 * exactly one primitive with exactly one material, so material name is a
 * reliable one-to-one handle on each object — the only reliable one available.
 *
 * This is also why the build pipeline gives this asset its own `interior`
 * profile: it must NOT merge meshes. Merging would save draw calls and leave
 * nothing to attach behaviour to.
 */

import type { Zone } from './zones';

/** Metres. The model is authored at real scale and is used unscaled. */
export const ROOM = {
  /** Flyable volume, inset from the walls by the craft's radius plus a margin. */
  bounds: {
    min: [-2.5, 0.35, -6.5] as [number, number, number],
    max: [10.5, 3.55, 0.5] as [number, number, number],
  },
  /**
   * Where the craft starts: mid-room, low, facing the control panel wall, and
   * deliberately outside every station's radius. The first spawn sat 1.9 m
   * from the Skills anchor, so the page opened with a panel already up and the
   * room hidden behind it before the visitor had touched a control.
   */
  spawn: [5.5, 1.4, -0.5] as [number, number, number],
  spawnYaw: -Math.PI / 2,
  /**
   * The model's own bounding box, measured. The set is open-fronted: it has
   * full walls only at z = -7 and x = 11, and above y = 2 the other two sides
   * are missing entirely, so you can see straight out of the room. `RoomShell`
   * closes it using these numbers.
   */
  shell: {
    min: [-3.1, 0, -7.06] as [number, number, number],
    max: [11.06, 4.05, 1.0] as [number, number, number],
  },
} as const;

export type Box = {
  /** Material name, for cross-referencing the model. */
  name: string;
  centre: [number, number, number];
  size: [number, number, number];
};

/**
 * Solid objects, as axis-aligned boxes.
 *
 * AABBs rather than real geometry on purpose. The alternative is a mesh
 * collider or a physics engine, and neither is worth its weight here: at
 * 2.2 m/s in a room this size, the difference between a box and the true
 * silhouette of a pipe is a few centimetres nobody will ever feel, and a
 * physics dependency would cost more than the whole scene.
 *
 * Only objects big enough to fly into are listed. The small jars on the desk
 * are not solid — clipping a 12 cm specimen jar is far less noticeable than
 * being mysteriously blocked by one.
 */
export const COLLIDERS: Box[] = [
  {
    name: 'Panel_sterowania',
    centre: [10.25, 1.3, -1.63],
    size: [1.34, 2.37, 4.22],
  },
  { name: 'szafka_body', centre: [0, 2.04, -6.19], size: [2.08, 3.99, 1.73] },
  { name: 'drzwi', centre: [7.68, 1.55, -6.78], size: [4.72, 3.04, 0.5] },
  {
    name: 'rura_gwna_baza',
    centre: [3, 1.99, -5.01],
    size: [3.25, 3.89, 3.25],
  },
  { name: 'rura_przod', centre: [-2.2, 0.77, -4.99], size: [1.1, 1.44, 2.83] },
  { name: 'rura_tylna', centre: [-2.69, 1.45, -4.98], size: [0.55, 2.8, 2.62] },
  { name: 'stolik', centre: [2, 0.39, -0.69], size: [2.65, 0.69, 1.49] },
  { name: 'szafka', centre: [10.61, 1.33, -5.1], size: [0.88, 2.58, 2.08] },
  { name: 'SCIANA_PODLOGA', centre: [-2.05, 1.5, -5], size: [2.1, 3, 4] },
  {
    name: 'szyba_przegroda',
    centre: [5.11, 1.43, -5.15],
    size: [0.12, 2.78, 3.79],
  },
];

export type StationKind = 'terminal' | 'panel';

export type Station = {
  id: string;
  /** The material whose mesh lights up as you approach. */
  material: string;
  /** Short label on the object's floating tag. */
  label: string;
  /**
   * `terminal` opens the project picker; `panel` shows one zone's content.
   * Exactly one terminal exists, and it is the control panel.
   */
  kind: StationKind;
  /** Zone id whose content this shows. Terminals list projects instead. */
  zoneId?: string;
  /** Where you have to be. Standing off the object's face, not inside it. */
  anchor: [number, number, number];
  /** Opens within this distance of `anchor`, in metres. */
  radius: number;
  /** Where the floating screen hangs. */
  screen: [number, number, number];
};

/**
 * Four stations, spread to the corners of the room so that reaching them all
 * means actually flying it. Approach anchors sit off each object's open face —
 * measured from the collider boxes above, because an anchor inside a solid
 * object is a station you can never quite reach.
 */
export const STATIONS: Station[] = [
  {
    id: 'projects',
    material: 'Panel_sterowania',
    label: 'Projects terminal',
    kind: 'terminal',
    anchor: [8.9, 1.4, -1.63],
    radius: 2.6,
    screen: [8.6, 1.95, -1.63],
  },
  {
    id: 'contact',
    material: 'drzwi',
    label: 'Contact',
    kind: 'panel',
    zoneId: 'contact',
    anchor: [7.68, 1.5, -5.9],
    radius: 2.2,
    screen: [7.68, 2.1, -5.7],
  },
  {
    id: 'skills',
    material: 'rura_gwna_baza',
    label: 'Skills',
    kind: 'panel',
    zoneId: 'skills',
    anchor: [3, 1.6, -3.0],
    radius: 2.2,
    screen: [3, 2.4, -3.1],
  },
  {
    id: 'about',
    material: 'szafka_body',
    label: 'About',
    kind: 'panel',
    zoneId: 'about',
    anchor: [0, 1.7, -4.9],
    radius: 2.2,
    screen: [0, 2.4, -4.8],
  },
];

/** Material names that should react to proximity at all. */
export const INTERACTIVE_MATERIALS = new Set(STATIONS.map((s) => s.material));

export const findStation = (id: string) =>
  STATIONS.find((station) => station.id === id);

/** The zones a terminal offers. Projects only — the rest have their own object. */
export const projectZones = (zones: Zone[]) =>
  zones.filter((zone) => zone.kind === 'project');
