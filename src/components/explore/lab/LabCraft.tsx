'use client';

import { Suspense } from 'react';
import { useGLTF } from '@react-three/drei';
import { PbrModel } from '../LoadedModel';
import { ProceduralDrone } from '../ProceduralDrone';

const URL = '/models/fyp-drone.glb';

/**
 * The craft you fly indoors: the FYP quad, from its own CAD.
 *
 * The same model the outdoor world flies (`DroneModel.tsx`, since
 * 2026-10-01), here at a size that fits the room: the airframe actually being
 * built - the Gemini 336 bar across the nose, the Jetson stack, RS2205 motors
 * on 5" props.
 *
 * ── Where it came from ──────────────────────────────────────────────────────
 * A Fusion OBJ export (1.6 M triangles, 83 appearances), converted by
 * scripts/obj-to-glb.mjs into assets/raw/fyp-drone.glb and then built like any
 * other asset. That script already turns it Y-up, metres, nose along −Z - the
 * direction labFlight.ts flies - so nothing is rotated here.
 *
 * ── The props turn ──────────────────────────────────────────────────────────
 * They are the only modelled rotors on the site: the converter keeps them as
 * named nodes with a `spinPivot`, and PbrModel spins those. `spin` is
 * `!reducedMotion`, as for the procedural fallback.
 *
 * The fallback is sized to match: ProceduralDrone is drawn for a 2.4 m span.
 */
export function LabCraft({ span, spin }: { span: number; spin: boolean }) {
  return (
    <Suspense
      fallback={
        <group scale={span / 2.4}>
          <ProceduralDrone spin={spin} />
        </group>
      }
    >
      <PbrModel url={URL} span={span} spin={spin} />
    </Suspense>
  );
}

// On screen before anything else in the lab; see DroneModel.tsx for the same
// call outdoors.
useGLTF.preload(URL, false);
