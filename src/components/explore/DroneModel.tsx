'use client';

import { Suspense } from 'react';
import { useGLTF } from '@react-three/drei';
import { PbrModel } from './LoadedModel';
import { ProceduralDrone } from './ProceduralDrone';

const URL = '/models/fyp-drone.glb';

/**
 * The drone you fly outdoors: the FYP quad, from its own CAD - the same
 * fyp-drone.glb /explore/lab flies (see `lab/LabCraft.tsx`). Replaced the
 * VT-802 on 2026-10-01, so both scenes fly the airframe actually being built.
 *
 * It is deliberately the only PBR object in the world. Everything around it is
 * unlit schematic geometry, so the craft reads as the one real thing in a
 * drawing of a place - which is also, conveniently, exactly where you want a
 * visitor's eye. See `LoadedModel.tsx` for why it needs the lighting rig, and
 * `Scene.tsx` for the rig itself.
 *
 * ── Orientation ─────────────────────────────────────────────────────────────
 * scripts/obj-to-glb.mjs already turns the CAD Y-up, metres, nose along −Z -
 * the direction the flight model flies - so nothing is rotated here (the
 * VT-802 needed a π turn about Y).
 *
 * ── Scale ───────────────────────────────────────────────────────────────────
 * The real quad spans 0.33 m; it is drawn at 2.4 m, the span the VT-802 had,
 * because the world is 120 units across and the chase camera, zone radii and
 * the procedural fallback were all tuned around a craft that size.
 *
 * ── The props turn ──────────────────────────────────────────────────────────
 * The converter keeps them as named nodes with a `spinPivot`, and PbrModel
 * spins those when given `spin` (`!reducedMotion`).
 */
export function DroneModel({ spin }: { spin: boolean }) {
  return (
    <Suspense fallback={<ProceduralDrone spin={spin} />}>
      <PbrModel url={URL} span={2.4} spin={spin} />
    </Suspense>
  );
}

// The craft is on screen before anything else and must never be the thing a
// visitor waits for. Preloaded HERE, not in LoadedModel.tsx, so that only the
// scene that flies it pays for it - the lab imports LoadedModel too.
useGLTF.preload(URL, false);
