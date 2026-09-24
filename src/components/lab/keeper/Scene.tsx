'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  type Group,
  type Mesh,
} from 'three';
import { safeCanvasEvents } from '@/lib/safeCanvasEvents';
import {
  BALL_RADIUS,
  GOAL_HALF_WIDTH,
  GOAL_HEIGHT,
  LAUNCH_Z,
  createKeeperSim,
  type Estimator,
  type KeeperSim,
  type SimSnapshot,
} from '@/lib/keeper/sim';
import { KeeperModel } from './KeeperModel';
import type { Controls, Readouts } from './types';

const EKF_COLOUR = '#3ddba0';
const LINE_COLOUR = '#e0a458';
const TRUTH_COLOUR = '#7d8794';

/** Readouts to React at 6 Hz: live enough to watch, cheap enough to ignore. */
const READOUT_INTERVAL = 1 / 6;

/** The goal mouth, as a schematic frame - the language the other scenes use. */
function Goal() {
  const geometry = useMemo(() => {
    const w = GOAL_HALF_WIDTH;
    const h = GOAL_HEIGHT;
    const p = [
      -w,
      0,
      0,
      -w,
      h,
      0,
      w,
      0,
      0,
      w,
      h,
      0,
      -w,
      h,
      0,
      w,
      h,
      0,
      -w,
      0,
      0,
      w,
      0,
      0,
    ];
    const buffer = new BufferGeometry();
    buffer.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(p), 3),
    );
    return buffer;
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#5f6570" />
    </lineSegments>
  );
}

/** A detection gate: the plane where the camera takes one of its two readings. */
function Gate({ z, label }: { z: number; label: string }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, GOAL_HEIGHT / 2, 0]}>
        <planeGeometry args={[GOAL_HALF_WIDTH * 2.2, GOAL_HEIGHT]} />
        <meshBasicMaterial
          color={label === 'far' ? '#2b6f8c' : '#2f8f74'}
          transparent
          opacity={0.07}
          depthWrite={false}
        />
      </mesh>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array([
                -GOAL_HALF_WIDTH * 1.1,
                0,
                0,
                GOAL_HALF_WIDTH * 1.1,
                0,
                0,
                -GOAL_HALF_WIDTH * 1.1,
                GOAL_HEIGHT,
                0,
                GOAL_HALF_WIDTH * 1.1,
                GOAL_HEIGHT,
                0,
              ]),
              3,
            ]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={label === 'far' ? '#3f8fae' : '#3ddba0'}
          transparent
          opacity={0.5}
        />
      </lineSegments>
    </group>
  );
}

/**
 * The depth camera: centred on the goal, behind it and above the crossbar,
 * looking down the pitch - where it sat on the real stand. Mounted high and
 * central it sees the whole mouth and the approach, and nothing the keeper
 * does can block its view of the ball.
 */
const CAMERA_POS: [number, number, number] = [0, GOAL_HEIGHT + 0.3, -0.35];

function CameraRig() {
  const geometry = useMemo(() => {
    const [ox, oy, oz] = CAMERA_POS;
    const spread = 1.9;
    const drop = -1.9;
    const rise = 0.35;
    const far = LAUNCH_Z;
    const p: number[] = [];
    for (const [dx, dy] of [
      [-spread, drop],
      [spread, drop],
      [-spread, rise],
      [spread, rise],
    ]) {
      p.push(ox, oy, oz, ox + dx, oy + dy, far);
    }
    const buffer = new BufferGeometry();
    buffer.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(p), 3),
    );
    return buffer;
  }, []);

  return (
    <group>
      {/* The housing, and the post carrying it above the bar. */}
      <mesh position={CAMERA_POS}>
        <boxGeometry args={[0.24, 0.09, 0.09]} />
        <meshBasicMaterial color="#8b94a1" />
      </mesh>
      <mesh position={[0, GOAL_HEIGHT + 0.15, -0.35]}>
        <boxGeometry args={[0.04, 0.3, 0.04]} />
        <meshBasicMaterial color="#5f6570" />
      </mesh>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#3f8fae" transparent opacity={0.16} />
      </lineSegments>
    </group>
  );
}

/**
 * A polyline whose points are rewritten in place each frame.
 *
 * Built as a real `THREE.Line` and mounted with `<primitive>` rather than
 * written as `<line>`, because in JSX that tag is the SVG element and the two
 * type declarations collide.
 */
function usePath(capacity: number, colour: string, opacity: number) {
  const line = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(capacity * 3), 3),
    );
    geometry.setDrawRange(0, 0);
    const material = new LineBasicMaterial({
      color: colour,
      transparent: true,
      opacity,
    });
    return new Line(geometry, material);
  }, [capacity, colour, opacity]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
    },
    [line],
  );

  const write = (points: { x: number; y: number; z: number }[]) => {
    const attribute = line.geometry.getAttribute('position') as BufferAttribute;
    const array = attribute.array as Float32Array;
    const count = Math.min(points.length, capacity);
    for (let i = 0; i < count; i += 1) {
      array[i * 3] = points[i].x;
      array[i * 3 + 1] = points[i].y;
      array[i * 3 + 2] = points[i].z;
    }
    line.geometry.setDrawRange(0, count);
    attribute.needsUpdate = true;
  };

  return { line, write };
}

function Simulation({
  controls,
  shotToken,
  onReadouts,
  simRef,
  reducedMotion,
}: {
  controls: Controls;
  shotToken: number;
  onReadouts: (readouts: Readouts) => void;
  simRef: React.RefObject<KeeperSim | null>;
  reducedMotion: boolean;
}) {
  const sim = useMemo(() => createKeeperSim(), []);
  simRef.current = sim;

  const ball = useRef<Mesh>(null);
  const arm = useRef<Group>(null);
  const ekfMark = useRef<Mesh>(null);
  const lineMark = useRef<Mesh>(null);

  const truthPath = usePath(420, TRUTH_COLOUR, 0.45);
  const ekfPath = usePath(260, EKF_COLOUR, 0.9);
  const linePath = usePath(260, LINE_COLOUR, 0.9);

  // Settings flow in from React; the loop below never reads React state.
  useEffect(() => {
    sim.configure({
      noise: controls.noise,
      farGate: controls.farGate,
      nearGate: controls.nearGate,
      estimator: controls.estimator,
    });
  }, [
    sim,
    controls.noise,
    controls.farGate,
    controls.nearGate,
    controls.estimator,
  ]);

  // A new token means the visitor pressed shoot.
  useEffect(() => {
    if (shotToken === 0) return;
    sim.shoot({
      aimX: controls.aimX,
      aimY: controls.aimY,
      speed: controls.speed,
    });
    // Only the token is a dependency: re-kicking because a slider moved would
    // make the controls unusable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotToken, sim]);

  const since = useRef(0);

  useFrame((_, delta) => {
    if (reducedMotion) {
      // Someone who has asked for less motion still gets the answer: the shot
      // is resolved in one frame, at the same fixed step the animated path
      // uses, so the sightings and the outcome are identical - only the
      // flying ball is gone. The cap stops a pathological run from spinning.
      for (let i = 0; i < 600 && sim.snapshot().phase === 'flight'; i += 1) {
        sim.step(1 / 120);
      }
      sim.step(1 / 30);
    } else {
      // Cap the step so a backgrounded tab does not teleport the ball past a
      // gate and skip a sighting.
      sim.step(Math.min(delta, 1 / 30));
    }
    const snap: SimSnapshot = sim.snapshot();

    if (ball.current) {
      ball.current.position.set(snap.ball.x, snap.ball.y, snap.ball.z);
      ball.current.visible = snap.phase !== 'ready';
    }
    if (arm.current) arm.current.rotation.z = -snap.armAngle;

    truthPath.write(snap.trail);
    ekfPath.write(snap.ekf?.path ?? []);
    linePath.write(snap.line?.path ?? []);

    const place = (mesh: Mesh | null, at: { x: number; y: number } | null) => {
      if (!mesh) return;
      mesh.visible = at !== null;
      if (at) mesh.position.set(at.x, at.y, 0);
    };
    place(ekfMark.current, snap.ekf?.crossing ?? null);
    place(lineMark.current, snap.line?.crossing ?? null);

    since.current += delta;
    if (since.current >= READOUT_INTERVAL || snap.phase === 'settled') {
      since.current = 0;
      const [, near] = snap.sightings;
      onReadouts({
        phase: snap.phase,
        sightings: snap.sightings.length,
        ekfError: snap.outcome ? snap.outcome.ekfError : null,
        lineError: snap.outcome ? snap.outcome.lineError : null,
        outcome: snap.outcome,
        shots: snap.shots,
        saves: snap.saves,
        reactionTime: near ? controls.nearGate / controls.speed : null,
      });
    }
  });

  return (
    <>
      {/* Pitch, as a faint plate. Enough to read height against, no more. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, LAUNCH_Z / 2]}>
        <planeGeometry args={[9, LAUNCH_Z + 2]} />
        <meshBasicMaterial color="#141a1f" />
      </mesh>
      <gridHelper
        args={[9, 9, '#232c34', '#1b2228']}
        position={[0, 0.002, LAUNCH_Z / 2]}
      />

      <Goal />
      <CameraRig />
      <Gate z={controls.farGate} label="far" />
      <Gate z={controls.nearGate} label="near" />

      <group ref={arm}>
        <KeeperModel reach />
      </group>

      <mesh ref={ball} visible={false}>
        <sphereGeometry args={[BALL_RADIUS, 20, 14]} />
        <meshBasicMaterial color="#cfd6df" />
      </mesh>

      <primitive object={truthPath.line} />
      <primitive object={ekfPath.line} />
      <primitive object={linePath.line} />

      <mesh ref={ekfMark} visible={false}>
        <ringGeometry args={[0.13, 0.17, 20]} />
        <meshBasicMaterial color={EKF_COLOUR} />
      </mesh>
      <mesh ref={lineMark} visible={false}>
        <ringGeometry args={[0.13, 0.17, 20]} />
        <meshBasicMaterial color={LINE_COLOUR} />
      </mesh>
    </>
  );
}

export function Scene(props: {
  controls: Controls;
  shotToken: number;
  onReadouts: (readouts: Readouts) => void;
  simRef: React.RefObject<KeeperSim | null>;
  reducedMotion: boolean;
  animating: boolean;
}) {
  return (
    <Canvas
      events={safeCanvasEvents}
      // Off-screen or in a hidden tab, the loop stops: the scene is a shot the
      // visitor asked for, not something that should keep drawing behind them.
      frameloop={props.animating ? 'always' : 'demand'}
      dpr={[1, 1.75]}
      camera={{ position: [4.6, 2.4, 6.4], fov: 45 }}
      gl={{ antialias: true, powerPreference: 'low-power' }}
    >
      <color attach="background" args={['#0e1114']} />
      <Simulation {...props} />
      <OrbitControls
        enablePan={false}
        target={[0, 1, 2.2]}
        minDistance={4}
        maxDistance={16}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.1}
        makeDefault
      />
    </Canvas>
  );
}

export type { Estimator };
