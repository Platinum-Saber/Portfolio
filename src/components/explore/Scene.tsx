'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, Html } from '@react-three/drei';
import { Vector3, type Camera, type Group, type Object3D } from 'three';
import { Drone, NEUTRAL } from '@/lib/explore/flight';
import type { FlightInput } from '@/lib/explore/flight';
import { ZONE_RADIUS, type Zone } from '@/lib/explore/zones';
import { DroneModel } from './DroneModel';
import { World, zoneColor } from './World';

/**
 * A request to reposition the drone, carried as a value rather than a mutable
 * ref. React's compiler is right to refuse a component writing back into a ref
 * its parent owns, so the parent bumps `nonce` instead and the scene remembers
 * which one it has already acted on. Same one-shot behaviour, no shared
 * mutable state across the boundary.
 */
export type JumpRequest = { id: string; nonce: number };

export type Telemetry = {
  altitude: number;
  speed: number;
  heading: number;
  nearestId: string | null;
  nearestDistance: number;
};

const CAMERA_BACK = 9;
const CAMERA_UP = 3.6;

/** Roughly the panel's rendered box. Only used to keep it inside the frame. */
const PANEL_W = 336;
const PANEL_H = 300;
const PANEL_MARGIN = 12;

const projected = new Vector3();

/**
 * Places the panel at its marker, but never outside the canvas.
 *
 * drei's default projects the anchor and leaves it there, which is fine until
 * you are close to the marker — and being close is the only time the panel is
 * open. Arriving at a zone put the anchor near the top of the frame and the
 * first lines of every panel ran off the edge.
 *
 * Clamping keeps the whole panel readable, and has a pleasant side effect:
 * when the marker drifts off-screen the panel slides along that edge, pointing
 * back towards what it belongs to instead of vanishing.
 */
function clampedPosition(
  el: Object3D,
  camera: Camera,
  size: { width: number; height: number },
): [number, number] {
  projected.setFromMatrixPosition(el.matrixWorld).project(camera);

  const halfW = size.width / 2;
  const halfH = size.height / 2;

  // Behind the camera the projection mirrors; flipping it back keeps the panel
  // on the side the marker actually is.
  const behind = projected.z > 1;
  const x = (behind ? -projected.x : projected.x) * halfW + halfW;
  const y = -((behind ? -projected.y : projected.y) * halfH) + halfH;

  const clamp = (value: number, max: number) =>
    Math.max(PANEL_MARGIN, Math.min(max, value));

  return [
    clamp(x - PANEL_W / 2, size.width - PANEL_W - PANEL_MARGIN),
    clamp(y - PANEL_H - PANEL_MARGIN, size.height - PANEL_H - PANEL_MARGIN),
  ];
}

function Rig({
  zones,
  input,
  flying,
  onEnter,
  onTelemetry,
  jump,
  activeId,
  discovered,
  reducedMotion,
}: {
  zones: Zone[];
  input: React.RefObject<FlightInput>;
  flying: boolean;
  onEnter: (id: string | null) => void;
  onTelemetry: (telemetry: Telemetry) => void;
  jump: JumpRequest | null;
  activeId: string | null;
  discovered: ReadonlySet<string>;
  reducedMotion: boolean;
}) {
  const drone = useMemo(() => new Drone(), []);
  const body = useRef<Group>(null);

  const desired = useMemo(() => new Vector3(), []);
  const look = useMemo(() => new Vector3(), []);

  const inZone = useRef<string | null>(null);
  const sinceTelemetry = useRef(0);
  // Owned here, so writing to it is this component's business.
  const servedJump = useRef(-1);

  useFrame((state, delta) => {
    if (jump && jump.nonce !== servedJump.current) {
      servedJump.current = jump.nonce;
      const target = zones.find((zone) => zone.id === jump.id);
      if (target) drone.teleport(target.position);
    }

    // Not flying means the drone holds station: it still exists, the camera
    // still frames it, it simply ignores input until control is taken.
    drone.step(delta, flying ? (input.current ?? NEUTRAL) : NEUTRAL);

    if (body.current) {
      body.current.position.set(drone.x, drone.y, drone.z);
      body.current.rotation.set(
        drone.tiltPitch,
        drone.yaw,
        drone.tiltRoll,
        'YXZ',
      );
    }

    // Chase camera. Positioned behind the drone in its own frame and eased in,
    // so a hard turn swings the view round rather than snapping it.
    const cos = Math.cos(drone.yaw);
    const sin = Math.sin(drone.yaw);
    desired.set(
      drone.x + sin * CAMERA_BACK,
      drone.y + CAMERA_UP,
      drone.z + cos * CAMERA_BACK,
    );
    // Framerate-independent easing, matching the flight model's approach.
    const blend = 1 - Math.exp(-Math.min(delta, 0.05) / 0.16);
    state.camera.position.lerp(desired, blend);
    look.set(drone.x, drone.y + 0.6, drone.z);
    state.camera.lookAt(look);

    // Zone entry. Hysteresis on the way out — leaving needs a little more
    // distance than entering — or a panel flickers when you hover on the edge.
    let nearestId: string | null = null;
    let nearestDistance = Infinity;
    let entered: string | null = null;

    for (const zone of zones) {
      const [zx, zy, zz] = zone.position;
      const distance = Math.hypot(drone.x - zx, drone.y - zy, drone.z - zz);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = zone.id;
      }
      const threshold =
        inZone.current === zone.id ? ZONE_RADIUS * 1.35 : ZONE_RADIUS;
      if (distance < threshold) entered = zone.id;
    }

    if (entered !== inZone.current) {
      inZone.current = entered;
      onEnter(entered);
    }

    sinceTelemetry.current += delta;
    if (sinceTelemetry.current > 0.2) {
      sinceTelemetry.current = 0;
      onTelemetry({
        altitude: drone.y,
        speed: drone.speed,
        heading: ((-drone.yaw * 180) / Math.PI + 360) % 360,
        nearestId,
        nearestDistance,
      });
    }
  });

  const active = zones.find((zone) => zone.id === activeId);

  return (
    <>
      <World
        zones={zones}
        discovered={discovered}
        activeId={activeId}
        reducedMotion={reducedMotion}
      />

      <Grid
        args={[4, 4]}
        cellSize={4}
        cellThickness={0.5}
        cellColor="#1c2128"
        sectionSize={20}
        sectionThickness={0.9}
        sectionColor="#243040"
        fadeDistance={140}
        fadeStrength={1.5}
        position={[0, 0, 0]}
        infiniteGrid
      />

      <group ref={body}>
        <DroneModel spin={!reducedMotion} />
      </group>

      {/*
        Exactly one panel exists at a time. Nine <Html> panels would mean nine
        DOM subtrees being reprojected every frame, and only one of them can be
        read anyway. It is real HTML rather than a canvas texture so the text
        can be selected, zoomed and read aloud.
      */}
      {active && (
        <Html
          position={[
            active.position[0],
            active.position[1] + 2.2,
            active.position[2],
          ]}
          calculatePosition={clampedPosition}
          zIndexRange={[40, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div>
            <div
              className="max-h-[300px] w-[min(72vw,21rem)] overflow-hidden rounded-lg border p-3.5 backdrop-blur-sm"
              style={{
                borderColor: zoneColor(active.kind),
                backgroundColor: 'rgba(11,14,17,0.92)',
                color: '#e8eaed',
              }}
            >
              <p
                className="font-mono text-[10px] tracking-widest uppercase"
                style={{ color: zoneColor(active.kind) }}
              >
                {active.short}
              </p>
              <h2 className="mt-1.5 text-base font-semibold">{active.title}</h2>
              {active.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 24)}
                  className="mt-2 text-[13px] leading-relaxed"
                  style={{ color: '#aab2bd' }}
                >
                  {paragraph}
                </p>
              ))}
              {active.tags && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {active.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded border px-1.5 py-0.5 font-mono text-[10px]"
                      style={{ borderColor: '#2c3946', color: '#7d8794' }}
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Html>
      )}
    </>
  );
}

export function Scene(props: {
  zones: Zone[];
  input: React.RefObject<FlightInput>;
  flying: boolean;
  onEnter: (id: string | null) => void;
  onTelemetry: (telemetry: Telemetry) => void;
  jump: JumpRequest | null;
  activeId: string | null;
  discovered: ReadonlySet<string>;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 11, 36], fov: 55, far: 400 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
    >
      <color attach="background" args={['#0b0e11']} />
      <fog attach="fog" args={['#0b0e11', 60, 190]} />
      <Rig {...props} reducedMotion={reducedMotion} />
    </Canvas>
  );
}

/**
 * State rather than a ref: the value has to reach the render, and it changes at
 * most once per visit, so the extra render costs nothing.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return reduced;
}
