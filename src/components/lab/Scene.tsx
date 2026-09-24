'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { safeCanvasEvents } from '@/lib/safeCanvasEvents';
import { Grid, OrbitControls } from '@react-three/drei';
import { DRONE_COMPONENTS } from '@/lib/drone';
import { Airframe } from './Airframe';
import { Hotspot } from './Hotspot';

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
  // zoom takes over.
  const [start] = useState<[number, number, number]>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640
      ? [0.42, 0.28, 0.42]
      : [0.54, 0.36, 0.54],
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
          position={[0, -0.11, 0]}
          infiniteGrid
        />

        <Airframe spin={animating} />

        {DRONE_COMPONENTS.map((component, index) => (
          <Hotspot
            key={component.id}
            component={component}
            index={index}
            active={selected === component.id}
            onSelect={onSelect}
          />
        ))}

        <OrbitControls
          enablePan={false}
          target={[0, 0.02, 0]}
          minDistance={0.4}
          maxDistance={1.4}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2.05}
          autoRotate={animating && !hasInteracted && selected === null}
          autoRotateSpeed={0.6}
          makeDefault
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
