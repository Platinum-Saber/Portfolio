'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import type { Group } from 'three';

const ACCENT = '#3ddba0';

/**
 * The drone you fly. A quadrotor in the same wireframe language as the
 * Airframe Explorer, because this world and that schematic should look like
 * they were drawn by the same hand.
 *
 * Forward is −Z, matching the flight model.
 */
export function DroneModel({ spin }: { spin: boolean }) {
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
