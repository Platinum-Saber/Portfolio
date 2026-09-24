'use client';

import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  type Object3D,
} from 'three';
import { COLLIDERS, ROOM, type Box } from '@/lib/explore/lab';

/**
 * The lab itself.
 *
 * Loaded and rendered as authored - its materials are already what we want and
 * the pipeline has already thinned them (see `scripts/build-assets.mjs`, the
 * `interior` profile). The only thing this component adds is the marker boxes,
 * and those are drawn from measured data rather than from the mesh.
 */
export function RoomModel() {
  const { scene } = useGLTF('/models/lab.glb', false);

  // Cloned per instance, like every other loaded model here: `useGLTF` caches
  // one scene graph per URL and it must not be mutated under other mounts.
  const object = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    object.traverse((child: Object3D) => {
      if (child instanceof Mesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
  }, [object]);

  return <primitive object={object} />;
}

/**
 * Bright enough to be a surface.
 *
 * The first pass used near-black fill and faint lines, on the theory that the
 * shell should recede. It receded so far it was indistinguishable from the
 * void it was covering - the gap still read as a hole, just a hole with a
 * couple of lines in it. A backdrop has to be visibly *something*.
 */
const SHELL_LINE = '#5c8b9c';
const SHELL_FILL = '#1b2b34';
/**
 * Metres between grid lines. The openings are only a metre or two from where
 * you fly, so the shell is seen steeply angled and close - at 2 m the lines
 * were too sparse to read as a surface from most of the room.
 */
const SHELL_CELL = 0.7;

/**
 * Closes the room.
 *
 * The set is open-fronted - the way almost every downloadable interior is.
 * Above y = 2 there are walls only at z = -7 and x = 11; the other two sides
 * simply are not modelled, so from most of the room you look out through a
 * hole into nothing and the canvas shows through as black.
 *
 * This draws a box round the whole room: a dark inward-facing surface so there
 * is something rather than nothing, and a grid of lines over it in the site's
 * schematic language, so what you see through the gap reads as the shell of a
 * facility rather than a mistake.
 *
 * ── Why all six faces, and not just the missing two ────────────────────────
 * Because the real walls are in front of it and hide it. Drawing the whole box
 * and letting the depth buffer sort it out means this component never has to
 * know which walls the model actually has - so it cannot fall out of step if
 * the room is ever re-exported with different geometry. The alternative,
 * enumerating the gaps, is a list that silently goes stale.
 *
 * The drone was already unable to reach the openings: the flight bounds in
 * `ROOM.bounds` sit ~0.6 m inside the shell on every axis. This is purely
 * about what you can see.
 */
export function RoomShell() {
  const { min, max } = ROOM.shell;

  const grid = useMemo(() => buildShellGrid(min, max), [min, max]);

  useEffect(() => {
    return () => {
      grid.geometry.dispose();
      (grid.material as LineBasicMaterial).dispose();
    };
  }, [grid]);

  const size: [number, number, number] = [
    max[0] - min[0],
    max[1] - min[1],
    max[2] - min[2],
  ];
  const centre: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];

  return (
    <group>
      {/* Inward-facing, unlit, and very dark: a floor for the eye to land on,
          not a surface competing with the room. */}
      <mesh position={centre}>
        <boxGeometry args={[size[0] + 0.3, size[1] + 0.3, size[2] + 0.3]} />
        <meshBasicMaterial color={SHELL_FILL} side={BackSide} />
      </mesh>
      <primitive object={grid} />
    </group>
  );
}

function buildShellGrid(
  min: readonly [number, number, number],
  max: readonly [number, number, number],
) {
  const positions: number[] = [];
  // Just inside the dark box, so the lines are never swallowed by it.
  const lo = [min[0] - 0.1, min[1] - 0.1, min[2] - 0.1];
  const hi = [max[0] + 0.1, max[1] + 0.1, max[2] + 0.1];

  const line = (a: number[], b: number[]) => positions.push(...a, ...b);

  /** Rules one face: `axis` is the face's normal, `at` its position. */
  const face = (axis: 0 | 1 | 2, at: number) => {
    const [u, v] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
    const point = (uValue: number, vValue: number) => {
      const p = [0, 0, 0];
      p[axis] = at;
      p[u] = uValue;
      p[v] = vValue;
      return p;
    };
    for (let value = lo[u]; value <= hi[u] + 1e-6; value += SHELL_CELL) {
      line(point(value, lo[v]), point(value, hi[v]));
    }
    for (let value = lo[v]; value <= hi[v] + 1e-6; value += SHELL_CELL) {
      line(point(lo[u], value), point(hi[u], value));
    }
  };

  face(0, lo[0]);
  face(0, hi[0]);
  face(1, lo[1]);
  face(1, hi[1]);
  face(2, lo[2]);
  face(2, hi[2]);

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(positions), 3),
  );
  return new LineSegments(
    geometry,
    new LineBasicMaterial({
      color: SHELL_LINE,
      transparent: true,
      opacity: 0.5,
    }),
  );
}

/**
 * The outline drawn round a station as you approach it.
 *
 * Built from the collider box in `lab.ts`, not from the object's own geometry.
 * That is deliberate: the box is exactly the volume you cannot fly into, so
 * the highlight is showing you the truth about the thing rather than a
 * decoration near it - approach and the outline tells you where you will stop.
 *
 * It is also the one place the lab borrows the rest of the site's visual
 * language. A photoreal room with a wireframe box round the thing you can use
 * ties it back to `/lab` and the explore world without turning the room itself
 * into a diagram.
 */
export function StationOutline({
  material,
  color,
  visible,
}: {
  material: string;
  color: string;
  visible: boolean;
}) {
  const box = COLLIDERS.find((candidate) => candidate.name === material);

  const lines = useMemo(() => {
    if (!box) return null;
    return buildOutline(box, color);
  }, [box, color]);

  useEffect(() => {
    return () => {
      if (!lines) return;
      lines.geometry.dispose();
      (lines.material as LineBasicMaterial).dispose();
    };
  }, [lines]);

  if (!lines) return null;

  return <primitive object={lines} visible={visible} />;
}

function buildOutline(box: Box, color: string) {
  const [w, h, d] = box.size;
  // A little larger than the collider so the outline reads as *around* the
  // object rather than z-fighting with its own surface.
  const geometry = new EdgesGeometry(
    new BoxGeometry(w + 0.08, h + 0.08, d + 0.08),
  );
  const lines = new LineSegments(
    geometry,
    new LineBasicMaterial({ color, transparent: true, opacity: 0.85 }),
  );
  lines.position.set(...box.centre);
  return lines;
}

useGLTF.preload('/models/lab.glb', false);
