'use client';

import { Suspense, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import type { Group } from 'three';
import { PbrModel } from './LoadedModel';

const ACCENT = '#3ddba0';

/**
 * The procedural quadrotor this world flew with before a real mesh existed.
 *
 * It is still here, and still worth its few KB, because it is what shows while
 * `/models/quadcopter.glb` is in flight — and what shows for good if that fetch
 * never lands. A flight sim with no aircraft is a worse failure than a plain
 * one, so the craft is never allowed to be missing.
 *
 * Forward is −Z, matching the flight model.
 */
function ProceduralDrone({ spin }: { spin: boolean }) {
  const rotors = useRef<Group>(null);

  useFrame((_, delta) => {
    // Deliberately not a real rotor speed. At anything like 5000 rpm the discs
    // strobe horribly against a 60 Hz refresh; this is fast enough to read as
    // running and slow enough to look intentional.
    if (spin && rotors.current) rotors.current.rotation.y += delta * 22;
  });

  const arms: Array<[number, number]> = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  return (
    <group>
      {/* Body. */}
      <mesh>
        <boxGeometry args={[0.62, 0.22, 0.86]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.22} />
        <Edges color={ACCENT} threshold={20} />
      </mesh>

      {/* Nose, so the heading is unambiguous from any angle. */}
      <mesh position={[0, 0, -0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.16, 0.34, 12]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.6} />
      </mesh>

      {arms.map(([sx, sz]) => (
        <group key={`${sx}${sz}`} position={[sx * 0.62, 0, sz * 0.62]}>
          {/* Arm. */}
          <mesh
            position={[-sx * 0.31, 0, -sz * 0.31]}
            rotation={[0, Math.atan2(sx, sz), 0]}
          >
            <boxGeometry args={[0.07, 0.07, 0.88]} />
            <meshBasicMaterial color={ACCENT} transparent opacity={0.3} />
          </mesh>
          {/* Motor. */}
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.14, 10]} />
            <meshBasicMaterial color={ACCENT} transparent opacity={0.35} />
            <Edges color={ACCENT} threshold={25} />
          </mesh>
          {/* Prop guard — a ring reads as a rotor disc without drawing blades. */}
          <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.27, 0.3, 20]} />
            <meshBasicMaterial
              color={ACCENT}
              transparent
              opacity={0.4}
              side={2}
            />
          </mesh>
        </group>
      ))}

      {/* All four blade pairs share one spinning group: four rotations a frame
          instead of sixteen, and nobody can tell them apart anyway. */}
      <group ref={rotors} position={[0, 0.16, 0]}>
        {arms.map(([sx, sz]) => (
          <mesh
            key={`r${sx}${sz}`}
            position={[sx * 0.62, 0, sz * 0.62]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.5, 0.05]} />
            <meshBasicMaterial
              color={ACCENT}
              transparent
              opacity={0.5}
              side={2}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * The drone you fly: the VT-802, rendered as authored.
 *
 * It is deliberately the only PBR object in the world. Everything around it is
 * unlit schematic geometry, so the craft reads as the one real thing in a
 * drawing of a place — which is also, conveniently, exactly where you want a
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
 * nodes to attach a rotation to. The fix is upstream rather than here: export
 * them as their own nodes, add `keepNamed: true` to the `join` step in
 * scripts/build-assets.mjs so they survive the merge, then find them by name
 * and turn them. Until then `spin` only drives the procedural fallback — the
 * one case where the craft has no modelled props to look wrong.
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
