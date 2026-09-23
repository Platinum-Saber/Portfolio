'use client';

import { ARM_LENGTH, SAVE_RADIUS } from '@/lib/keeper/sim';

/**
 * The keeper: an arm on a servo, pivoting about the goal's centre, exactly as
 * the real one does — the figure is mounted on the shaft and swings.
 *
 * Drawn from the goal's centre outward so the rotation is the servo angle and
 * nothing else, which keeps the readout and the picture the same number.
 */
export function KeeperModel({ reach }: { reach: boolean }) {
  const colour = reach ? '#3ddba0' : '#5f6570';
  return (
    <group>
      {/* Arm. Pivot is at the origin of this group; the group is rotated. */}
      <mesh position={[0, ARM_LENGTH / 2, 0]}>
        <boxGeometry args={[0.12, ARM_LENGTH, 0.12]} />
        <meshBasicMaterial color={colour} transparent opacity={0.85} />
      </mesh>
      {/* The glove — the bit that actually has to be in the right place. */}
      <mesh position={[0, ARM_LENGTH, 0]}>
        <sphereGeometry args={[SAVE_RADIUS, 20, 14]} />
        <meshBasicMaterial color={colour} transparent opacity={0.28} />
      </mesh>
      <mesh position={[0, ARM_LENGTH, 0]}>
        <sphereGeometry args={[0.08, 16, 12]} />
        <meshBasicMaterial color={colour} />
      </mesh>
    </group>
  );
}
