'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { safeCanvasEvents } from '@/lib/safeCanvasEvents';
import { OrbitControls } from '@react-three/drei';
import {
  BufferAttribute,
  BufferGeometry,
  type DataTexture,
  type Group,
  type LineSegments,
  type Points,
} from 'three';
import { ARENA, ARENA_HALF } from '@/lib/slam/arena';
import { GridLayer } from '@/lib/slam/layer';
import { createSim } from '@/lib/slam/sim';
import { ScoutModel } from './ScoutModel';
import type { DriveInput, Readouts, ViewMode } from './types';

const ALPHA = '#3ddba0';
const BRAVO = '#e0a458';

const ALPHA_RGB = [61, 219, 160] as const;
const BRAVO_RGB = [224, 164, 88] as const;
const MERGED_RGB = [207, 214, 223] as const;
const FLOOR_RGB = [42, 58, 70] as const;

/** Repaint at 12 Hz. The maps change slowly; uploading them at 60 would be waste. */
const TEXTURE_INTERVAL = 1 / 12;
/** Readouts go to React at 4 Hz - fast enough to feel live, slow enough not to thrash. */
const READOUT_INTERVAL = 1 / 4;

/** The arena itself, as a wireframe cage. Static, so it is built once. */
function Walls() {
  const geometry = useMemo(() => {
    const height = 0.55;
    const positions: number[] = [];

    for (const wall of ARENA) {
      const ax = wall.x1;
      const az = -wall.y1;
      const bx = wall.x2;
      const bz = -wall.y2;

      // Base, cap, and a vertical at each end.
      positions.push(ax, 0, az, bx, 0, bz);
      positions.push(ax, height, az, bx, height, bz);
      positions.push(ax, 0, az, ax, height, az);
      positions.push(bx, 0, bz, bx, height, bz);
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
      <lineBasicMaterial color="#2c3946" transparent opacity={0.9} />
    </lineSegments>
  );
}

function Simulation({
  view,
  driving,
  input,
  onReadouts,
  running,
  generation,
}: {
  view: ViewMode;
  driving: 'alpha' | 'bravo' | null;
  input: React.RefObject<DriveInput>;
  onReadouts: (readouts: Readouts) => void;
  running: boolean;
  generation: number;
}) {
  // Rebuilt whenever `generation` changes, which is what the restart button
  // increments - see the note on createSim for why that beats a reset method.
  // Safe in useMemo precisely because the simulation is seeded and pure: two
  // calls with the same generation produce byte-identical runs.
  //
  // exhaustive-deps calls `generation` unnecessary because createSim takes no
  // arguments. Here it is not a dependency but a cache key: it is the entire
  // mechanism by which restart works, and removing it makes the button dead.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sim = useMemo(() => createSim(), [generation]);

  const alphaGroup = useRef<Group>(null);
  const bravoGroup = useRef<Group>(null);
  const beams = useRef<LineSegments>(null);
  const hits = useRef<Points>(null);

  // One set of layers per simulation. Tied to `sim` rather than to `size` so a
  // restart starts from blank textures instead of inheriting the old run's map.
  const layers = useMemo(() => {
    const size = sim.merged.size;
    return {
      alpha: new GridLayer(size),
      bravo: new GridLayer(size),
      fused: new GridLayer(size),
    };
  }, [sim]);

  useEffect(
    () => () => {
      layers.alpha.dispose();
      layers.bravo.dispose();
      layers.fused.dispose();
    },
    [layers],
  );

  const beamGeometry = useMemo(() => {
    // 90 beams per scout, two scouts, two vertices per beam.
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(90 * 2 * 2 * 3), 3),
    );
    return geometry;
  }, []);

  const hitGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(90 * 2 * 3), 3),
    );
    return geometry;
  }, []);

  const sinceTexture = useRef(0);
  const sinceReadout = useRef(0);

  useFrame((_, delta) => {
    const simulation = sim;
    const command = input.current ?? { forward: 0, turn: 0 };

    if (running) {
      simulation.step(delta, driving, [
        command.forward * 0.9,
        command.turn * 2.0,
      ]);
    }

    // Poses. Simulation is 2D in (x, y); the scene is (x, up, -y).
    if (alphaGroup.current) {
      alphaGroup.current.position.set(
        simulation.alpha.truth.x,
        0,
        -simulation.alpha.truth.y,
      );
      alphaGroup.current.rotation.y = simulation.alpha.truth.th;
    }
    if (bravoGroup.current) {
      bravoGroup.current.position.set(
        simulation.bravo.truth.x,
        0,
        -simulation.bravo.truth.y,
      );
      bravoGroup.current.rotation.y = simulation.bravo.truth.th;
    }

    // Live beams, drawn from the true pose because that is where the sensor
    // physically is. The drift lives in the map, not in the light.
    if (beams.current && hits.current) {
      const beamArray = beamGeometry.getAttribute('position')
        .array as Float32Array;
      const hitArray = hitGeometry.getAttribute('position')
        .array as Float32Array;
      let b = 0;
      let h = 0;

      for (const scout of [simulation.alpha, simulation.bravo]) {
        const ox = scout.truth.x;
        const oz = -scout.truth.y;
        for (const point of scout.scan) {
          beamArray[b++] = ox;
          beamArray[b++] = 0.19;
          beamArray[b++] = oz;
          beamArray[b++] = point.x;
          beamArray[b++] = 0.19;
          beamArray[b++] = -point.y;

          if (point.hit) {
            hitArray[h++] = point.x;
            hitArray[h++] = 0.19;
            hitArray[h++] = -point.y;
          }
        }
      }

      // Collapse the unused tail to a degenerate point rather than leaving
      // last frame's beams hanging in space.
      while (b < beamArray.length) beamArray[b++] = 0;
      while (h < hitArray.length) hitArray[h++] = 0;

      beamGeometry.getAttribute('position').needsUpdate = true;
      hitGeometry.getAttribute('position').needsUpdate = true;
    }

    sinceTexture.current += delta;
    if (sinceTexture.current >= TEXTURE_INTERVAL) {
      sinceTexture.current = 0;

      // Only the visible layers are repainted; the others are not on screen
      // and their grids are still accumulating regardless.
      if (view === 'alpha' || view === 'unaligned') {
        layers.alpha.refresh(simulation.alpha.local, ALPHA_RGB, FLOOR_RGB);
      }
      if (view === 'bravo' || view === 'unaligned') {
        layers.bravo.refresh(simulation.bravo.local, BRAVO_RGB, FLOOR_RGB);
      }
      if (view === 'fused') {
        layers.fused.refresh(simulation.merged, MERGED_RGB, FLOOR_RGB);
      }
    }

    sinceReadout.current += delta;
    if (sinceReadout.current >= READOUT_INTERVAL) {
      sinceReadout.current = 0;
      onReadouts({
        elapsed: simulation.elapsed,
        alphaCoverage: simulation.alpha.local.coverage(),
        bravoCoverage: simulation.bravo.local.coverage(),
        fusedCoverage: simulation.merged.coverage(),
        alphaError: simulation.alpha.positionError,
        bravoError: simulation.bravo.positionError,
        alphaHeading: simulation.alpha.headingError,
        bravoHeading: simulation.bravo.headingError,
      });
    }
  });

  const plane = (
    texture: DataTexture,
    visible: boolean,
    height: number,
    key: string,
  ) => (
    <mesh
      key={key}
      visible={visible}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, height, 0]}
    >
      <planeGeometry args={[ARENA_HALF * 2, ARENA_HALF * 2]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );

  return (
    <>
      <Walls />

      {/* Slightly different heights so the two unaligned maps never z-fight. */}
      {plane(
        layers.alpha.texture,
        view === 'alpha' || view === 'unaligned',
        0.002,
        'a',
      )}
      {plane(
        layers.bravo.texture,
        view === 'bravo' || view === 'unaligned',
        0.004,
        'b',
      )}
      {plane(layers.fused.texture, view === 'fused', 0.003, 'm')}

      <lineSegments ref={beams} geometry={beamGeometry}>
        <lineBasicMaterial color="#6be3bb" transparent opacity={0.11} />
      </lineSegments>

      <points ref={hits} geometry={hitGeometry}>
        <pointsMaterial
          color="#9ff0d4"
          size={0.05}
          transparent
          opacity={0.65}
        />
      </points>

      <group ref={alphaGroup}>
        <ScoutModel color={ALPHA} driven={driving === 'alpha'} />
      </group>
      <group ref={bravoGroup}>
        <ScoutModel color={BRAVO} driven={driving === 'bravo'} />
      </group>
    </>
  );
}

export function Scene(props: {
  view: ViewMode;
  driving: 'alpha' | 'bravo' | null;
  input: React.RefObject<DriveInput>;
  onReadouts: (readouts: Readouts) => void;
  running: boolean;
  generation: number;
}) {
  return (
    <Canvas
      events={safeCanvasEvents}
      dpr={[1, 1.75]}
      camera={{ position: [0, 11, 11], fov: 42 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
    >
      <color attach="background" args={['#0e1114']} />
      <Simulation {...props} />
      <OrbitControls
        enablePan={false}
        target={[0, 0, 0]}
        minDistance={5}
        maxDistance={26}
        minPolarAngle={0.15}
        // Stop just short of the horizon: below it the ground plane the maps
        // live on is edge-on and the whole visualisation vanishes.
        maxPolarAngle={Math.PI / 2.3}
        makeDefault
      />
    </Canvas>
  );
}
