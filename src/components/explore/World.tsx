'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, type Group } from 'three';
import { makeSeededRandom } from '@/lib/random';
import { WORLD_HALF, ZONE_RADIUS, type Zone } from '@/lib/explore/zones';

const ACCENT = '#3ddba0';
const AMBER = '#e0a458';
const STRUCTURE = '#2c3946';

export const zoneColor = (kind: Zone['kind']) =>
  kind === 'project' ? ACCENT : AMBER;

/**
 * Terrain, of a sort: scattered wireframe blocks that exist purely so the eye
 * has something to measure motion against. An empty plane gives no parallax,
 * and without parallax flying feels like sliding a cursor.
 *
 * One merged LineSegments rather than fifty meshes — the whole city is a single
 * draw call.
 */
function Scenery() {
  const geometry = useMemo(() => {
    // Seeded, so the skyline is the same on every visit and can be composed
    // around rather than being a different accident each load.
    const random = makeSeededRandom(20260822);

    const positions: number[] = [];

    const addBox = (
      cx: number,
      cz: number,
      w: number,
      h: number,
      d: number,
    ) => {
      const x0 = cx - w / 2;
      const x1 = cx + w / 2;
      const z0 = cz - d / 2;
      const z1 = cz + d / 2;
      const corners: Array<[number, number]> = [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ];
      for (let i = 0; i < 4; i += 1) {
        const [ax, az] = corners[i];
        const [bx, bz] = corners[(i + 1) % 4];
        positions.push(ax, 0, az, bx, 0, bz);
        positions.push(ax, h, az, bx, h, bz);
        positions.push(ax, 0, az, ax, h, az);
      }
    };

    for (let i = 0; i < 46; i += 1) {
      const x = (random() * 2 - 1) * (WORLD_HALF - 8);
      const z = (random() * 2 - 1) * (WORLD_HALF - 8);
      // Keep the middle clear: it is where the drone starts and where the
      // first three markers live.
      if (Math.hypot(x, z) < 12) continue;
      addBox(x, z, 3 + random() * 7, 2 + random() * 12, 3 + random() * 7);
    }

    const buffer = new BufferGeometry();
    buffer.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(positions), 3),
    );
    return buffer;
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={STRUCTURE} transparent opacity={0.75} />
    </lineSegments>
  );
}

/** The edge of the world, drawn so nobody wonders whether they can leave. */
function Boundary() {
  const geometry = useMemo(() => {
    const h = 26;
    const s = WORLD_HALF;
    const positions: number[] = [];
    const corners: Array<[number, number]> = [
      [-s, -s],
      [s, -s],
      [s, s],
      [-s, s],
    ];
    for (let i = 0; i < 4; i += 1) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      positions.push(ax, 0, az, bx, 0, bz);
      positions.push(ax, h, az, bx, h, bz);
      positions.push(ax, 0, az, ax, h, az);
      // A few horizontal rungs so the wall reads as a surface, not four lines.
      for (let r = 1; r < 4; r += 1) {
        positions.push(ax, (h * r) / 4, az, bx, (h * r) / 4, bz);
      }
    }
    const buffer = new BufferGeometry();
    buffer.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(positions), 3),
    );
    return buffer;
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={STRUCTURE} transparent opacity={0.35} />
    </lineSegments>
  );
}

function Marker({
  zone,
  discovered,
  active,
  reducedMotion,
}: {
  zone: Zone;
  discovered: boolean;
  active: boolean;
  reducedMotion: boolean;
}) {
  const ring = useRef<Group>(null);
  const color = zoneColor(zone.kind);
  const [x, y, z] = zone.position;

  useFrame((state, delta) => {
    if (!ring.current) return;
    // Under prefers-reduced-motion the markers hold still. They are decoration
    // — the drone's own movement is the visitor's doing and stays.
    if (reducedMotion) return;
    ring.current.rotation.y += delta * (active ? 1.4 : 0.5);
    // Undiscovered markers bob, which is what makes them read as "come here"
    // from across the map. Once found they settle.
    ring.current.position.y = discovered
      ? 0
      : Math.sin(state.clock.elapsedTime * 1.6) * 0.5;
  });

  return (
    <group position={[x, y, z]}>
      <group ref={ring}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ZONE_RADIUS * 0.32, ZONE_RADIUS * 0.36, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={active ? 0.95 : discovered ? 0.5 : 0.75}
            side={2}
          />
        </mesh>
        <mesh>
          <octahedronGeometry args={[0.9, 0]} />
          <meshBasicMaterial
            color={color}
            wireframe
            transparent
            opacity={active ? 0.9 : 0.55}
          />
        </mesh>
      </group>

      {/* Beam down to the ground: the marker's altitude is information, and
          without a tether you cannot tell how high it is floating. */}
      <mesh position={[0, -y / 2, 0]}>
        <cylinderGeometry args={[0.035, 0.035, y, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} />
      </mesh>

      {/* Landing circle. */}
      <mesh position={[0, -y + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ZONE_RADIUS - 0.25, ZONE_RADIUS, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 0.5 : 0.16}
          side={2}
        />
      </mesh>
    </group>
  );
}

export function World({
  zones,
  discovered,
  activeId,
  reducedMotion,
}: {
  zones: Zone[];
  discovered: ReadonlySet<string>;
  activeId: string | null;
  reducedMotion: boolean;
}) {
  return (
    <>
      <Scenery />
      <Boundary />

      {/* Ground. Dark and matte so the markers and the drone carry all the
          brightness in the frame. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[WORLD_HALF * 2, WORLD_HALF * 2]} />
        <meshBasicMaterial color="#0b0e11" />
      </mesh>

      {zones.map((zone) => (
        <Marker
          key={zone.id}
          zone={zone}
          discovered={discovered.has(zone.id)}
          active={activeId === zone.id}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
}
