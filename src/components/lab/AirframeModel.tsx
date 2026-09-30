'use client';

import { Suspense } from 'react';
import { useGLTF } from '@react-three/drei';
import { SchematicModel } from '../explore/LoadedModel';
import { Airframe, CameraFrustum } from './Airframe';

/**
 * Not the lab room's fyp-drone.glb: the `parts` build of the same source keeps
 * each component as its own mesh (and drops appearance, which a schematic
 * never draws) - 214 KB against 739.
 */
const URL = '/models/fyp-drone-parts.glb';
const ACCENT = '#3ddba0';

/**
 * The longest side of the built model's bounding box, in metres. Passing it as
 * the span makes `normalise` scale by exactly 1, so the scene is the real
 * aircraft at real size and the hotspot coordinates in src/lib/drone.ts are
 * measurements, not placements. Re-measure if the CAD changes.
 */
const SPAN = 0.3313921;

/** Front face of the Gemini 336 in scene coordinates (measured from the CAD). */
const LENS: [number, number, number] = [0, 0.0056, 0.1015];

/**
 * The FYP quad in /lab, from its own CAD - the same fyp-drone.glb the lab
 * room flies, drawn in this page's instrument language instead of as
 * authored: unlit fill and hard edges, like everything else on /lab.
 *
 * ── Why a mesh here now ─────────────────────────────────────────────────────
 * On 2026-08-23 a mesh was rejected for this page because a stock drone would
 * have made every callout point at a stranger's airframe. This one is the
 * airframe being built, so the reason no longer holds - and the markers now
 * sit on measured component positions rather than on primitives placed to
 * look about right.
 *
 * ── Selecting a component ──────────────────────────────────────────────────
 * Each marker's component is its own mesh in the asset (the converter sorts
 * CAD bodies into components - scripts/fyp-drone.parts.mjs), so selecting one
 * lights exactly that part's geometry and fades the rest; Scene.tsx moves the
 * camera onto it.
 *
 * ── Why it is turned round ──────────────────────────────────────────────────
 * The asset is nose along −Z, for the flight models. This scene has always
 * put the nose on +Z (the frustum and every hotspot coordinate assume it), so
 * it is turned here, not in the file.
 */
export function AirframeModel({
  spin,
  selected,
  instant,
}: {
  spin: boolean;
  /** Component id from src/lib/drone.ts - lit up, with the rest faded. */
  selected: string | null;
  instant: boolean;
}) {
  return (
    <Suspense fallback={<Airframe spin={spin} />}>
      <group rotation={[0, Math.PI, 0]}>
        <SchematicModel
          url={URL}
          span={SPAN}
          color={ACCENT}
          fillOpacity={0.1}
          edgeOpacity={0.5}
          threshold={30}
          spin={spin}
          highlight={selected}
          instant={instant}
        />
      </group>
      <CameraFrustum position={LENS} />
    </Suspense>
  );
}

useGLTF.preload(URL, false);
