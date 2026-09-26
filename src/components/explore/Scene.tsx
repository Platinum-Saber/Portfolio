'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { safeCanvasEvents } from '@/lib/safeCanvasEvents';
import { Grid, Html } from '@react-three/drei';
import { Vector3, type Group } from 'three';
import { clampedPosition } from './panelPosition';
import { Drone, NEUTRAL } from '@/lib/explore/flight';
import type { FlightInput } from '@/lib/explore/flight';
import { ZONE_RADIUS, type Zone } from '@/lib/explore/zones';
import { DroneModel } from './DroneModel';
import { Lighting } from './Lighting';
import { World, zoneColor } from './World';
import { Ribbon } from './Ribbon';
import { Guide } from '@/lib/explore/guide';
import { ConsoleCard } from '../ConsoleCard';

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
  /** Zone the guide is flying to (9.2), or null under manual control. */
  guidingTo: string | null;
};

const CAMERA_BACK = 9;
const CAMERA_UP = 3.6;

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
  const guide = useMemo(() => new Guide(), []);
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
      if (target) {
        // 9.2: a jump is a guided flight. Teleport is the reduced-motion
        // branch only - an instant reposition is the right behaviour there,
        // and a cut everywhere else.
        if (reducedMotion) drone.teleport(target.position);
        else
          guide.start(
            target.id,
            [drone.x, drone.y, drone.z],
            drone.yaw,
            target.position,
          );
      }
    }

    // Taking the sticks ends a guided flight on the spot. The craft keeps the
    // velocity the guide gave it, so the hand-over is continuous.
    const pilot = flying ? (input.current ?? NEUTRAL) : NEUTRAL;
    const touching =
      Math.abs(pilot.pitch) +
        Math.abs(pilot.roll) +
        Math.abs(pilot.lift) +
        Math.abs(pilot.yaw) >
      0.05;
    if (touching) guide.cancel();

    // The guide runs on wall-clock time, not the physics step's 50 ms clamp:
    // its duration is a promise ("about three seconds to MediBox"), and at a
    // low frame rate a clamped clock would stretch that promise out. The
    // 0.25 s cap only stops a backgrounded tab resuming mid-route.
    const guideDt = Math.min(delta, 0.25);
    const pose = guide.update(guideDt);
    if (pose) drone.follow(pose.x, pose.y, pose.z, pose.yaw, guideDt);
    // Not flying means the drone holds station: it still exists, the camera
    // still frames it, it simply ignores input until control is taken.
    else drone.step(delta, pilot);

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

    // Zone entry. Hysteresis on the way out - leaving needs a little more
    // distance than entering - or a panel flickers when you hover on the edge.
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

    // A guided route can cross other zones' trigger radius on the way. They
    // must not open mid-flight, nor count as found - the visitor did not go
    // there. Entry resumes the moment the guide lets go, which on arrival
    // opens the target exactly as a teleport did.
    if (guide.driving) entered = null;

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
        guidingTo: guide.target,
      });
    }
  });

  const active = zones.find((zone) => zone.id === activeId);

  return (
    <>
      <Lighting />

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

      <Ribbon guide={guide} />

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
          {/* 9.1: an instrument readout on the ConsoleCard primitive in HUD
              glass, not a website card floating in the sky. Same text, same
              size box (clampedPosition's PANEL_W/H assume it). */}
          <ConsoleCard
            tone="hud"
            accent={zoneColor(active.kind)}
            title={active.short}
            meta={active.kind}
            scroll
            className="max-h-[300px] w-[min(72vw,21rem)] overflow-hidden"
            lead={
              <>
                <h2 className="text-base font-semibold">{active.title}</h2>
                {active.body.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 24)}
                    className="mt-2 text-[13px] leading-relaxed"
                    style={{ color: 'var(--fg-muted)' }}
                  >
                    {paragraph}
                  </p>
                ))}
              </>
            }
          >
            {active.tags && (
              // Label above, value below and left-aligned: the panel is too
              // narrow for a label column beside a multi-line tag list.
              <div>
                <dt
                  className="font-mono text-[11px] tracking-wider uppercase"
                  style={{ color: 'var(--fg-muted)' }}
                >
                  Stack
                </dt>
                <dd
                  className="mt-1 font-mono text-[11px] leading-relaxed"
                  style={{ color: 'var(--fg)' }}
                >
                  {active.tags.join(' · ')}
                </dd>
              </div>
            )}
          </ConsoleCard>
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
      events={safeCanvasEvents}
      dpr={[1, 1.75]}
      camera={{ position: [0, 11, 36], fov: 55, far: 400 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      /* Reflections only - set so the generated room lights the
         craft to read as metal against a deliberately dark world. */
      scene={{ environmentIntensity: 1.05 }}
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
