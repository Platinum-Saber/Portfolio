'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';

/**
 * A procedural X-quadrotor, generated from primitives rather than loaded from
 * a mesh file. Two reasons: it costs a few KB instead of megabytes, and it can
 * be edited as code as the real build changes.
 *
 * Roughly to scale in metres. Read it as a schematic, not a render.
 */

const ACCENT = '#3ddba0';
const STRUCTURE = '#5f6570';

/** Arm end positions in an X configuration. */
const ARM_ANGLES = [45, 135, 225, 315].map((d) => (d * Math.PI) / 180);
const ARM_LENGTH = 0.22;

function armPosition(angle: number, scale = 1): [number, number, number] {
  return [
    Math.cos(angle) * ARM_LENGTH * scale,
    0,
    Math.sin(angle) * ARM_LENGTH * scale,
  ];
}

/** Thin carbon plate with a highlighted edge outline. */
function Plate({
  y,
  size,
  thickness = 0.003,
}: {
  y: number;
  size: [number, number];
  thickness?: number;
}) {
  return (
    <mesh position={[0, y, 0]}>
      <boxGeometry args={[size[0], thickness, size[1]]} />
      <meshBasicMaterial color={STRUCTURE} transparent opacity={0.18} />
      <Edges color={ACCENT} threshold={15} />
    </mesh>
  );
}

function Arm({ angle }: { angle: number }) {
  const [x, , z] = armPosition(angle, 0.5);
  return (
    <mesh position={[x, 0, z]} rotation={[0, -angle, 0]}>
      <boxGeometry args={[ARM_LENGTH, 0.006, 0.014]} />
      <meshBasicMaterial color={STRUCTURE} transparent opacity={0.25} />
      <Edges color={ACCENT} threshold={15} />
    </mesh>
  );
}

function Motor({ angle }: { angle: number }) {
  const [x, , z] = armPosition(angle);
  return (
    <mesh position={[x, 0.014, z]}>
      <cylinderGeometry args={[0.014, 0.014, 0.022, 16]} />
      <meshBasicMaterial color={STRUCTURE} transparent opacity={0.3} />
      <Edges color={ACCENT} threshold={30} />
    </mesh>
  );
}

/** Two-blade prop disc. Spins unless the visitor prefers reduced motion. */
function Propeller({
  angle,
  spin,
  index,
}: {
  angle: number;
  spin: boolean;
  index: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const [x, , z] = armPosition(angle);
  // Counter-rotating pairs, as on a real quad.
  const direction = index % 2 === 0 ? 1 : -1;

  useFrame((_, delta) => {
    if (!spin || !ref.current) return;
    ref.current.rotation.y += delta * 9 * direction;
  });

  return (
    <group ref={ref} position={[x, 0.03, z]}>
      <mesh>
        <boxGeometry args={[0.2, 0.001, 0.016]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.35} />
      </mesh>
      {/* Swept-disc outline: the volume the prop actually claims. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.099, 0.1, 48]} />
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/** Generic payload block — compute module, camera, battery. */
function Block({
  position,
  size,
  color = ACCENT,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={STRUCTURE} transparent opacity={0.22} />
      <Edges color={color} threshold={15} />
    </mesh>
  );
}

/** Depth camera frustum — shows what the Gemini 336 actually sees. */
function CameraFrustum() {
  const geometry = useMemo(() => {
    // H 90° x V 65°, drawn to 0.6 m for legibility rather than the full range.
    const depth = 0.6;
    const halfW = Math.tan((90 * Math.PI) / 360) * depth;
    const halfH = Math.tan((65 * Math.PI) / 360) * depth;
    const apex = new THREE.Vector3(0, 0, 0);
    const corners = [
      new THREE.Vector3(-halfW, -halfH, depth),
      new THREE.Vector3(halfW, -halfH, depth),
      new THREE.Vector3(halfW, halfH, depth),
      new THREE.Vector3(-halfW, halfH, depth),
    ];
    const points: THREE.Vector3[] = [];
    corners.forEach((c, i) => {
      points.push(apex, c);
      points.push(c, corners[(i + 1) % corners.length]);
    });
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);

  return (
    <lineSegments geometry={geometry} position={[0, 0.02, 0.13]}>
      <lineBasicMaterial color={ACCENT} transparent opacity={0.16} />
    </lineSegments>
  );
}

export function Airframe({ spin }: { spin: boolean }) {
  return (
    <group>
      {/* Primary structure: two carbon plates sandwiching the battery bay. */}
      <Plate y={0.02} size={[0.13, 0.13]} />
      <Plate y={-0.02} size={[0.13, 0.13]} />

      {ARM_ANGLES.map((angle, i) => (
        <group key={angle}>
          <Arm angle={angle} />
          <Motor angle={angle} />
          <Propeller angle={angle} spin={spin} index={i} />
        </group>
      ))}

      {/* Jetson Orin Nano — 100 x 79 mm carrier, stacked above the top plate. */}
      <Block position={[0, 0.055, -0.02]} size={[0.1, 0.03, 0.079]} />
      {/* Orbbec Gemini 336 — 90 x 25 x 30.7 mm, forward-facing. */}
      <Block position={[0, 0.02, 0.115]} size={[0.09, 0.025, 0.031]} />
      {/* Battery, between the plates. */}
      <Block
        position={[0, -0.035, 0]}
        size={[0.105, 0.028, 0.04]}
        color={STRUCTURE}
      />
      {/* Flight controller, aft on the top plate. */}
      <Block position={[0, 0.012, -0.075]} size={[0.05, 0.012, 0.036]} />

      <CameraFrustum />
    </group>
  );
}
