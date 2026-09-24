'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
  type Points,
} from 'three';
import type { Guide } from '@/lib/explore/guide';

/**
 * The waypoint ribbon — Phase 9.2, Tier B particles (DESIGN-LANGUAGE §5.1).
 *
 * One BufferGeometry of COUNT points, allocated once. A new route rewrites its
 * positions a single time (when `guide.version` changes); everything that
 * moves after that — the ribbon drawing itself out, light pulsing along it
 * towards the target, the stretch behind the craft dissolving — is the vertex
 * shader reading four uniforms. No per-particle JavaScript in the render loop.
 *
 * Additive and unlit, in the accent, like the rest of the world's schematic
 * language. Not fogged: it is a guide, and a guide you cannot see the end of
 * is not guiding.
 */

const COUNT = 220;
const ACCENT = new Color('#3ddba0');

const vertexShader = /* glsl */ `
  attribute float aT;
  uniform float uTime;
  uniform float uDrawn;
  uniform float uProgress;
  uniform float uScale;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    // Drawn so far: the ribbon grows from the craft to the zone.
    float shown = step(aT, uDrawn);
    // Behind the craft: dissolves just after it passes.
    float ahead = smoothstep(uProgress - 0.015, uProgress + 0.035, aT);
    // Light travelling along the route, towards the target.
    float pulse = pow(fract(aT * 7.0 - uTime * 0.85), 5.0);
    // The drawing tip burns brighter while the ribbon is being laid down.
    float tip = shown * smoothstep(uDrawn - 0.05, uDrawn, aT) * step(uDrawn, 0.999);

    vAlpha = shown * ahead * (0.32 + 0.68 * pulse + tip);
    gl_PointSize = uScale * (0.55 + 0.7 * pulse + 1.2 * tip) / max(-mv.z, 0.1);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float soft = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, soft * vAlpha * uOpacity);
  }
`;

export function Ribbon({ guide }: { guide: Guide }) {
  const points = useRef<Points>(null);
  const built = useRef(-1);

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3));
    const t = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i += 1) t[i] = i / (COUNT - 1);
    g.setAttribute('aT', new BufferAttribute(t, 1));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uDrawn: { value: 0 },
          uProgress: { value: 0 },
          uOpacity: { value: 0 },
          uScale: { value: 1 },
          uColor: { value: ACCENT },
        },
      }),
    [],
  );

  useFrame((state, delta) => {
    const mesh = points.current;
    if (!mesh) return;

    if (guide.phase === 'idle' || !guide.curve) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    if (built.current !== guide.version) {
      built.current = guide.version;
      const attribute = geometry.getAttribute('position') as BufferAttribute;
      const samples = guide.curve.getSpacedPoints(COUNT - 1);
      samples.forEach((p, i) => attribute.setXYZ(i, p.x, p.y, p.z));
      attribute.needsUpdate = true;
      geometry.computeBoundingSphere();
    }

    // World-size points: ~0.5 m across, in device pixels.
    const fov = 'fov' in state.camera ? (state.camera.fov as number) : 55;
    const pixels = state.size.height * state.viewport.dpr;
    const u = material.uniforms;
    u.uScale.value = (0.5 * pixels) / (2 * Math.tan((fov * Math.PI) / 360));
    u.uTime.value += Math.min(delta, 0.05);
    u.uDrawn.value = guide.drawn;
    u.uProgress.value = guide.progress;
    u.uOpacity.value = guide.opacity;
  });

  return (
    <points
      ref={points}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      visible={false}
    />
  );
}
