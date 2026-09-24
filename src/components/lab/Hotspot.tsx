'use client';

import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { DroneComponent } from '@/lib/drone';

/**
 * A numbered marker pushed clear of the airframe, with a leader line back to
 * the component it points at - the instrument-panel convention, and the only
 * way six labels on a 30 cm airframe stay separable from every angle.
 *
 * Deliberately no `distanceFactor`: markers keep a constant screen size, so
 * they stay a reliable tap target on a phone instead of shrinking with depth.
 */
export function Hotspot({
  component,
  index,
  active,
  onSelect,
}: {
  component: DroneComponent;
  index: number;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const leader = useMemo(() => {
    const points = [
      new THREE.Vector3(...component.position),
      new THREE.Vector3(...component.marker),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [component.position, component.marker]);

  return (
    <group>
      <line>
        <primitive object={leader} attach="geometry" />
        <lineBasicMaterial
          color="#3ddba0"
          transparent
          opacity={active ? 0.7 : 0.28}
        />
      </line>

      {/* Anchor dot on the component itself. */}
      <mesh position={component.position}>
        <sphereGeometry args={[0.006, 8, 8]} />
        <meshBasicMaterial
          color="#3ddba0"
          transparent
          opacity={active ? 1 : 0.6}
        />
      </mesh>

      <group position={component.marker}>
        <Html center zIndexRange={[20, 0]}>
          <button
            type="button"
            onClick={() => onSelect(component.id)}
            aria-label={`${component.name} - ${component.short}`}
            aria-pressed={active}
            className="grid size-7 cursor-pointer place-items-center rounded-full border font-mono text-[11px] transition-transform hover:scale-110"
            style={{
              borderColor: active
                ? 'var(--accent)'
                : 'color-mix(in srgb, var(--accent) 50%, transparent)',
              backgroundColor: active
                ? 'var(--accent)'
                : 'rgba(14, 17, 20, 0.85)',
              color: active ? '#0e1114' : 'var(--accent)',
              boxShadow: active
                ? '0 0 0 5px color-mix(in srgb, var(--accent) 20%, transparent)'
                : 'none',
            }}
          >
            {index + 1}
          </button>
        </Html>
      </group>
    </group>
  );
}
