'use client';

import { Suspense } from 'react';
import { useGLTF } from '@react-three/drei';
import { PbrModel } from './LoadedModel';
import { ProceduralDrone } from './ProceduralDrone';

/**
 * The drone you fly: the VT-802, rendered as authored.
 *
 * It is deliberately the only PBR object in the world. Everything around it is
 * unlit schematic geometry, so the craft reads as the one real thing in a
 * drawing of a place - which is also, conveniently, exactly where you want a
 * visitor's eye. See `LoadedModel.tsx` for why it needs the lighting rig, and
 * `Scene.tsx` for the rig itself.
 *
 * ── Why it is turned around ─────────────────────────────────────────────────
 * The model is built nose-along-+Z: the hull number and the sensor dome are on
 * that face, the exhaust bells and the lamp on the other. The flight model
 * flies along −Z. Rotating here rather than baking it into the asset keeps the
 * file canonical and keeps the reason readable.
 *
 * ── Why the rotors do not turn ──────────────────────────────────────────────
 * The pipeline merges the source into a single mesh, so there are no rotor
 * nodes to attach a rotation to. The fix is upstream rather than here, and the
 * lab's craft shows it working: its props are named nodes carrying a
 * `spinPivot` (scripts/obj-to-glb.mjs), its ASSETS entry sets `keepNamed`, and
 * PbrModel turns them when given `spin`. Until the VT-802 is re-exported the
 * same way, `spin` here only drives the procedural fallback - the one case
 * where the craft has no modelled props to look wrong.
 *
 * Outdoors only. /explore/lab flies the FYP quad - see `lab/LabCraft.tsx`.
 */
export function DroneModel({ spin }: { spin: boolean }) {
  return (
    <Suspense fallback={<ProceduralDrone spin={spin} />}>
      <group rotation={[0, Math.PI, 0]}>
        <PbrModel url="/models/vt-802.glb" span={2.4} />
      </group>
    </Suspense>
  );
}

// The craft is on screen before anything else and must never be the thing a
// visitor waits for. Preloaded HERE, not in LoadedModel.tsx, so that only the
// scene that flies it pays for it - the lab imports LoadedModel too.
useGLTF.preload('/models/vt-802.glb', false);
