'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { safeCanvasEvents } from '@/lib/safeCanvasEvents';
import { Grid, OrbitControls } from '@react-three/drei';
import { DRONE_COMPONENTS, getComponent } from '@/lib/drone';
import { AirframeModel } from './AirframeModel';
import { Hotspot } from './Hotspot';

/** How far the camera sits from a selected component. */
const FOCUS_DISTANCE = 0.32;

/**
 * Moves the orbit onto the selected component: the target slides to the
 * part's measured position and the camera closes to FOCUS_DISTANCE, keeping
 * whatever angle the visitor was looking from. Deselecting slides back to the
 * whole airframe at the opening distance.
 *
 * It eases once and lets go. The moment the visitor grabs the controls the
 * move is dropped, so it never fights a drag - and orbiting afterwards pivots
 * round the selected part, which is the point of focusing on it.
 *
 * The camera and controls are reached through useFrame's state, not held from
 * a hook, so the only things mutated are what three hands the frame callback.
 */
function Focus({
  selected,
  home,
  instant,
}: {
  selected: string | null;
  home: number;
  instant: boolean;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const controls = useThree((state) => state.controls);
  const goal = useRef<{ target: Vector3; distance: number } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    // Not on mount: the opening framing is Scene's, and autoRotate owns it.
    if (first.current) {
      first.current = false;
      return;
    }
    const component = selected ? getComponent(selected) : undefined;
    goal.current = {
      target: new Vector3(
        ...(component?.focus?.target ?? component?.position ?? [0, 0, 0]),
      ),
      distance: component
        ? (component.focus?.distance ?? FOCUS_DISTANCE)
        : home,
    };
    invalidate();
  }, [selected, home, invalidate]);

  useEffect(() => {
    if (!controls) return;
    const release = () => {
      goal.current = null;
    };
    const dispatcher = controls as unknown as {
      addEventListener: (type: string, fn: () => void) => void;
      removeEventListener: (type: string, fn: () => void) => void;
    };
    dispatcher.addEventListener('start', release);
    return () => dispatcher.removeEventListener('start', release);
  }, [controls]);

  useFrame((state, delta) => {
    const g = goal.current;
    const orbit = state.controls as unknown as
      | { target: Vector3; update: () => void }
      | null;
    if (!g || !orbit) return;
    const k = instant ? 1 : 1 - Math.exp(-delta * 6);
    const offset = state.camera.position.clone().sub(orbit.target);
    orbit.target.lerp(g.target, k);
    const length = offset.length();
    offset.setLength(length + (g.distance - length) * k);
    state.camera.position.copy(orbit.target).add(offset);
    orbit.update();
    const settled =
      orbit.target.distanceTo(g.target) < 1e-4 &&
      Math.abs(offset.length() - g.distance) < 1e-4;
    if (settled) goal.current = null;
    else invalidate();
  });

  return null;
}

/**
 * Render loop policy - this is most of what keeps /lab inside the budget:
 *  - stops entirely when the tab is hidden or the canvas scrolls out of view
 *  - stops the props (and never starts the loop) under prefers-reduced-motion
 *  - caps DPR at 1.75 so high-density phones don't render 3x the pixels
 */
export function Scene({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Auto-rotation is an invitation, not a feature. The moment the visitor
  // touches the scene it stops for good - a slowly drifting model makes the
  // hotspots genuinely hard to hit, especially on touch.
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      {
        threshold: 0.05,
      },
    );
    observer.observe(el);

    const onVisibilityChange = () => {
      if (document.hidden) setVisible(false);
      else setVisible(el.getBoundingClientRect().bottom > 0);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const animating = visible && !reducedMotion;

  // Narrow viewports get a closer camera - the same framing that reads well at
  // 1100px leaves the airframe tiny at 390px. Set once, then the visitor's own
  // zoom takes over. Closer than the procedural airframe needed: the real quad
  // is 33 cm across its guards, where the primitives spanned ~50 cm of props.
  const [start] = useState<[number, number, number]>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640
      ? [0.34, 0.23, 0.34]
      : [0.42, 0.28, 0.42],
  );

  return (
    <div
      ref={wrapper}
      onPointerDown={() => setHasInteracted(true)}
      onWheel={() => setHasInteracted(true)}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border sm:aspect-[16/10]"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--bg-subtle)',
      }}
    >
      <Canvas
        events={safeCanvasEvents}
        frameloop={animating ? 'always' : 'demand'}
        dpr={[1, 1.75]}
        camera={{ position: start, fov: 38 }}
        gl={{ antialias: true, powerPreference: 'low-power' }}
      >
        <color attach="background" args={['#0e1114']} />

        <Grid
          args={[2, 2]}
          cellSize={0.05}
          cellThickness={0.5}
          cellColor="#1c2128"
          sectionSize={0.25}
          sectionThickness={0}
          sectionColor="#1c2128"
          fadeDistance={1.15}
          fadeStrength={2}
          position={[0, -0.075, 0]}
          infiniteGrid
        />

        <AirframeModel
          spin={animating}
          selected={selected}
          instant={reducedMotion}
        />

        {DRONE_COMPONENTS.map((component, index) => (
          <Hotspot
            key={component.id}
            component={component}
            index={index}
            active={selected === component.id}
            dimmed={selected !== null && selected !== component.id}
            onSelect={onSelect}
          />
        ))}

        <OrbitControls
          enablePan={false}
          target={[0, 0, 0]}
          minDistance={0.3}
          maxDistance={1.1}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2.05}
          autoRotate={animating && !hasInteracted && selected === null}
          autoRotateSpeed={0.6}
          makeDefault
        />

        <Focus
          selected={selected}
          home={Math.hypot(...start)}
          instant={reducedMotion}
        />
      </Canvas>

      <p
        className="pointer-events-none absolute bottom-3 left-3 font-mono text-[11px]"
        /* The canvas is always dark, in both themes - so this overlay can't
           use --fg-muted, which goes dark grey in light mode. */
        style={{ color: '#7d8794' }}
      >
        drag to orbit · scroll to zoom · tap a marker
      </p>
    </div>
  );
}
