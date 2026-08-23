'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Vector3, type Group } from 'three';
import { NEUTRAL, type FlightInput } from '@/lib/explore/flight';
import { LabDrone } from '@/lib/explore/labFlight';
import { STATIONS, findStation, type Station } from '@/lib/explore/lab';
import type { Zone } from '@/lib/explore/zones';
import { DroneModel } from '../DroneModel';
import { Lighting } from '../Lighting';
import { clampedPosition } from '../panelPosition';
import { RoomModel, RoomShell, StationOutline } from './RoomModel';

export type JumpRequest = { id: string; nonce: number };

export type LabTelemetry = {
  speed: number;
  heading: number;
  nearestId: string | null;
  nearestDistance: number;
};

const ACCENT = '#3ddba0';
const AMBER = '#e0a458';

/**
 * Chase camera, indoors.
 *
 * Far closer than the outdoor rig's 9 m: at that distance in a 14 m room the
 * camera spends most of its time inside a wall, and you fly by watching a
 * ceiling. Close enough that the craft still reads, far enough that you can see
 * what you are about to hit.
 */
const CAMERA_BACK = 1.5;
const CAMERA_UP = 0.55;

const CRAFT_SPAN = 0.4;

function Rig({
  zones,
  input,
  flying,
  reducedMotion,
  onStation,
  onTelemetry,
  jump,
  activeStation,
  selectedProject,
  onSelectProject,
  onOpenProject,
}: {
  zones: Zone[];
  input: React.RefObject<FlightInput>;
  flying: boolean;
  reducedMotion: boolean;
  onStation: (id: string | null) => void;
  onTelemetry: (telemetry: LabTelemetry) => void;
  jump: JumpRequest | null;
  activeStation: string | null;
  selectedProject: string | null;
  onSelectProject: (id: string | null) => void;
  onOpenProject: (id: string) => void;
}) {
  const drone = useMemo(() => new LabDrone(), []);
  const body = useRef<Group>(null);

  const desired = useMemo(() => new Vector3(), []);
  const look = useMemo(() => new Vector3(), []);

  const inStation = useRef<string | null>(null);
  const sinceTelemetry = useRef(0);
  const servedJump = useRef(-1);

  useFrame((state, delta) => {
    if (jump && jump.nonce !== servedJump.current) {
      servedJump.current = jump.nonce;
      const target = findStation(jump.id);
      if (target) drone.moveTo(target.anchor, target.screen);
    }

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

    const cos = Math.cos(drone.yaw);
    const sin = Math.sin(drone.yaw);
    desired.set(
      drone.x + sin * CAMERA_BACK,
      drone.y + CAMERA_UP,
      drone.z + cos * CAMERA_BACK,
    );
    const blend = 1 - Math.exp(-Math.min(delta, 0.05) / 0.16);
    state.camera.position.lerp(desired, blend);
    look.set(drone.x, drone.y + 0.1, drone.z);
    state.camera.lookAt(look);

    // Proximity, with hysteresis on the way out — without it a station on the
    // edge of its radius flickers open and shut while you hover.
    let nearestId: string | null = null;
    let nearestDistance = Infinity;
    let entered: string | null = null;

    for (const station of STATIONS) {
      const [ax, ay, az] = station.anchor;
      const distance = Math.hypot(drone.x - ax, drone.y - ay, drone.z - az);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = station.id;
      }
      const threshold =
        inStation.current === station.id
          ? station.radius * 1.3
          : station.radius;
      if (distance < threshold) entered = station.id;
    }

    if (entered !== inStation.current) {
      inStation.current = entered;
      onStation(entered);
    }

    sinceTelemetry.current += delta;
    if (sinceTelemetry.current > 0.2) {
      sinceTelemetry.current = 0;
      onTelemetry({
        speed: drone.speed,
        heading: ((-drone.yaw * 180) / Math.PI + 360) % 360,
        nearestId,
        nearestDistance,
      });
    }
  });

  const station = activeStation ? findStation(activeStation) : undefined;

  return (
    <>
      <Lighting keyIntensity={0.9} fillIntensity={0.35} />
      <RoomShell />
      <RoomModel />

      {STATIONS.map((candidate) => (
        <StationOutline
          key={candidate.id}
          material={candidate.material}
          color={candidate.kind === 'terminal' ? ACCENT : AMBER}
          visible={activeStation === candidate.id}
        />
      ))}

      <group ref={body}>
        <group scale={CRAFT_SPAN / 2.4}>
          <DroneModel spin={!reducedMotion} />
        </group>
      </group>

      {station && (
        <Html
          position={station.screen}
          calculatePosition={clampedPosition}
          zIndexRange={[40, 0]}
          /* Pointer events are ON here, unlike the outdoor panels: this one is
             a control, not a caption. The wrapper below re-disables them for
             the parts that are only text. */
          style={{ pointerEvents: 'auto' }}
        >
          <StationScreen
            station={station}
            zones={zones}
            selectedProject={selectedProject}
            onSelectProject={onSelectProject}
            onOpenProject={onOpenProject}
          />
        </Html>
      )}
    </>
  );
}

const SURFACE = 'rgba(9,13,16,0.94)';

function StationScreen({
  station,
  zones,
  selectedProject,
  onSelectProject,
  onOpenProject,
}: {
  station: Station;
  zones: Zone[];
  selectedProject: string | null;
  onSelectProject: (id: string | null) => void;
  onOpenProject: (id: string) => void;
}) {
  if (station.kind === 'terminal') {
    return (
      <Terminal
        zones={zones}
        selectedProject={selectedProject}
        onSelectProject={onSelectProject}
        onOpenProject={onOpenProject}
      />
    );
  }

  const zone = zones.find((candidate) => candidate.id === station.zoneId);
  if (!zone) return null;

  return (
    <div
      className="max-h-[300px] w-[min(72vw,21rem)] overflow-hidden rounded-lg border p-3.5 backdrop-blur-sm"
      style={{ borderColor: AMBER, backgroundColor: SURFACE, color: '#e8eaed' }}
    >
      <p
        className="font-mono text-[10px] tracking-widest uppercase"
        style={{ color: AMBER }}
      >
        {zone.short}
      </p>
      <h2 className="mt-1.5 text-base font-semibold">{zone.title}</h2>
      {zone.body.map((paragraph) => (
        <p
          key={paragraph.slice(0, 24)}
          className="mt-2 text-[13px] leading-relaxed"
          style={{ color: '#aab2bd' }}
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}

/**
 * The projects terminal.
 *
 * Two states, list and detail, rather than one long scroll. The list has to be
 * readable at a glance while you are holding a drone still, so it is six rows
 * and nothing else; the detail is what you asked for, so it can be dense.
 *
 * Everything here is operable three ways — click, tap, and the arrow keys plus
 * Enter (wired up in `LabExplorer`). A control that only responds to a mouse
 * would be the one part of this page a keyboard user cannot reach, and the
 * whole point of the terminal is that it is the way to the projects.
 */
function Terminal({
  zones,
  selectedProject,
  onSelectProject,
  onOpenProject,
}: {
  zones: Zone[];
  selectedProject: string | null;
  onSelectProject: (id: string | null) => void;
  onOpenProject: (id: string) => void;
}) {
  const projects = zones.filter((zone) => zone.kind === 'project');
  const open = projects.find((project) => project.id === selectedProject);

  return (
    <div
      className="w-[min(80vw,23rem)] overflow-hidden rounded-lg border backdrop-blur-sm"
      style={{
        borderColor: ACCENT,
        backgroundColor: SURFACE,
        color: '#e8eaed',
      }}
    >
      <div
        className="flex items-baseline justify-between border-b px-3.5 py-2"
        style={{ borderColor: 'rgba(61,219,160,0.35)' }}
      >
        <p
          className="font-mono text-[10px] tracking-widest uppercase"
          style={{ color: ACCENT }}
        >
          {open ? 'Project' : `Projects · ${projects.length}`}
        </p>
        {open && (
          <button
            type="button"
            onClick={() => onSelectProject(null)}
            className="font-mono text-[10px] hover:underline"
            style={{ color: ACCENT }}
          >
            ← all projects
          </button>
        )}
      </div>

      {!open && (
        <ul className="max-h-[264px] overflow-y-auto py-1">
          {projects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => onSelectProject(project.id)}
                className="flex w-full items-baseline justify-between gap-3 px-3.5 py-2 text-left hover:bg-white/5"
              >
                <span className="text-[13px] font-medium">{project.label}</span>
                <span
                  className="font-mono text-[10px] whitespace-nowrap"
                  style={{ color: '#7d8794' }}
                >
                  {project.short}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="max-h-[264px] overflow-y-auto px-3.5 py-3">
          <h2 className="text-base font-semibold">{open.title}</h2>
          {open.body.map((paragraph) => (
            <p
              key={paragraph.slice(0, 24)}
              className="mt-2 text-[13px] leading-relaxed"
              style={{ color: '#aab2bd' }}
            >
              {paragraph}
            </p>
          ))}
          {open.tags && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {open.tags.map((tag) => (
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
          <button
            type="button"
            onClick={() => onOpenProject(open.id)}
            className="mt-3 text-[13px] hover:underline"
            style={{ color: ACCENT }}
          >
            Read the full write-up →
          </button>
        </div>
      )}
    </div>
  );
}

export function LabScene(props: {
  zones: Zone[];
  input: React.RefObject<FlightInput>;
  flying: boolean;
  onStation: (id: string | null) => void;
  onTelemetry: (telemetry: LabTelemetry) => void;
  jump: JumpRequest | null;
  activeStation: string | null;
  selectedProject: string | null;
  onSelectProject: (id: string | null) => void;
  onOpenProject: (id: string) => void;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [5, 1.8, 1.2], fov: 62, near: 0.05, far: 60 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      /* Held down hard. The room's materials are pale and its own panels are
         emissive, so the first pass at 1.4 blew it out to near-white and lost
         every surface it was meant to show. Under-lighting a room whose
         screens glow costs nothing; over-lighting it costs the whole set. */
      scene={{ environmentIntensity: 0.75 }}
    >
      <color attach="background" args={['#05070a']} />
      <Rig {...props} reducedMotion={reducedMotion} />
    </Canvas>
  );
}

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
