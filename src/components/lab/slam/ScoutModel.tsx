'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import type { Group } from 'three';

/**
 * A scout: cylindrical chassis, two drive wheels, a spinning LiDAR puck.
 *
 * ── Swapping in the real model ──────────────────────────────────────────────
 * This is procedural so the page works before any asset exists. When the CAD
 * is exported, drop the optimised file at `public/models/scout.glb` and replace
 * the body of this component with:
 *
 *   const { scene } = useGLTF('/models/scout.glb');
 *   return <primitive object={scene.clone()} />;
 *
 * Keep three things or the scene stops making sense:
 *   1. The model must be Z-up-agnostic: this scene puts the floor at y = 0 and
 *      the robot's forward axis along +X, matching the simulation's heading.
 *   2. Overall diameter about 0.32 m, so the body stays consistent with the
 *      0.16 m collision radius the simulation enforces.
 *   3. Leave the `lidar` ref attached to whatever spins, or delete the
 *      useFrame — a stationary LiDAR reads as a broken robot.
 *
 * That model will also need the Phase 3 asset pipeline, which is parked
 * precisely until a real .glb like this one exists. Unpark it then.
 */
export function ScoutModel({
  color,
  driven,
}: {
  color: string;
  /** The scout the visitor is controlling gets a brighter shell. */
  driven: boolean;
}) {
  const lidar = useRef<Group>(null);

  useFrame((_, delta) => {
    // An RPLiDAR A1 turns at about 5.5 Hz. Matching it is free and means the
    // one number a roboticist might idly check is right.
    if (lidar.current) lidar.current.rotation.y += delta * 5.5 * Math.PI * 2;
  });

  const shell = driven ? 0.34 : 0.2;

  return (
    <group>
      {/* Chassis. */}
      <mesh position={[0, 0.09, 0]} castShadow={false}>
        <cylinderGeometry args={[0.15, 0.15, 0.11, 24]} />
        <meshBasicMaterial color={color} transparent opacity={shell} />
        <Edges color={color} threshold={20} />
      </mesh>

      {/* Drive wheels, on the lateral axis so forward is +X. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[0, 0.045, side * 0.15]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.045, 0.045, 0.02, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} />
          <Edges color={color} threshold={20} />
        </mesh>
      ))}

      {/* Castor, so it does not read as a two-wheeled unicycle. */}
      <mesh position={[-0.11, 0.022, 0]}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>

      {/* LiDAR: a fixed base with a rotating head. */}
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.055, 0.06, 0.03, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} />
        <Edges color={color} threshold={20} />
      </mesh>
      <group ref={lidar} position={[0, 0.195, 0]}>
        <mesh>
          <cylinderGeometry args={[0.05, 0.05, 0.035, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} />
          <Edges color={color} threshold={20} />
        </mesh>
        {/* The emitter window — the visual cue that it is spinning at all. */}
        <mesh position={[0.045, 0, 0]}>
          <boxGeometry args={[0.014, 0.024, 0.03]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>

      {/* Heading spike. Without it you cannot tell which way a cylinder faces. */}
      <mesh position={[0.15, 0.09, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.035, 0.08, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} />
      </mesh>
    </group>
  );
}
