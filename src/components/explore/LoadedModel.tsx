'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  Box3,
  EdgesGeometry,
  Group,
  Object3D as Object3DImpl,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';

/**
 * Two ways to put a loaded GLB into this world, matching the two profiles the
 * build pipeline emits (see `scripts/build-assets.mjs`).
 *
 * `SchematicModel` redraws a mesh in the site's own language - unlit fill at
 * low opacity with its hard edges picked out, exactly as `Airframe.tsx` and
 * `World.tsx` draw their procedural geometry. Scenery uses it, so that the
 * world stays one drawing rather than a wireframe city with photographs
 * parked in it.
 *
 * `PbrModel` leaves the material exactly as authored - base colour, normal and
 * metallic-roughness. The craft you fly uses it: it is the one object a visitor
 * looks at directly, it is a machined metal thing, and reading as metal is most
 * of what sells it.
 *
 * ── The two are lit differently, and that is the whole distinction ──────────
 * Schematic geometry is `MeshBasicMaterial`: unlit, so it ignores every light
 * in the scene and shows its colour exactly as given. That is what keeps the
 * world looking drawn rather than photographed.
 *
 * The craft is `MeshStandardMaterial` and needs the lighting rig in `Scene.tsx` -
 * specifically the generated environment map. A metal surface reflects its
 * surroundings and emits nothing itself, so a metallic material with nothing to
 * reflect renders very nearly black however many lamps point at it. Lights, PBR
 * materials and that environment are one decision. Do not remove one of them.
 *
 * ── Draco is disabled on purpose ────────────────────────────────────────────
 * `useGLTF`'s second argument defaults to true, which points a DRACOLoader at
 * `https://www.gstatic.com/draco/...` - a third-party CDN fetch on the render
 * path of a site whose whole architecture is "nothing on the render path can
 * break". Passing `false` turns it off. The assets use meshopt instead, whose
 * decoder drei bundles locally, so nothing is fetched from any origin but ours.
 */

type Anchor = 'centre' | 'floor';

/**
 * Scales a loaded scene to a known size and puts it where the caller expects.
 *
 * Worth doing rather than trusting the file: the two sources arrive at
 * unrelated scales, and without this a re-export at different units would
 * silently resize the craft.
 */
function normalise(root: Object3D, span: number, anchor: Anchor) {
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  const factor = span / Math.max(size.x, size.y, size.z, 1e-6);

  root.scale.setScalar(factor);
  root.position.set(
    -centre.x * factor,
    anchor === 'floor' ? -box.min.y * factor : -centre.y * factor,
    -centre.z * factor,
  );
}

/**
 * Rotor speed in rad/s. The procedural fallback's number, for the same reason:
 * a real rotor speed strobes against a 60 Hz refresh, and this reads as
 * running while still looking intentional.
 */
const SPIN_RATE = 22;

/**
 * Puts every node that carries a `spinPivot` (in glTF extras, so three's
 * `userData`) under a pivot group at that point, and returns the pivots.
 *
 * The pivot has to come from data because the node's own origin is NOT the
 * hub by the time it gets here: the pipeline's `quantize` step folds a
 * dequantisation offset into every node transform, which for a prop is the
 * middle of its bounding box - 1.5 cm off the shaft on the FYP quad. Turning
 * the node itself would make each prop orbit rather than spin. The pivot is in
 * the node's parent space, which quantize never touches.
 */
function mountRotors(root: Object3D) {
  const rotors: Object3D[] = [];
  root.traverse((child: Object3D) => {
    if (Array.isArray(child.userData.spinPivot)) rotors.push(child);
  });
  for (const rotor of rotors) {
    const [x, y, z] = rotor.userData.spinPivot as [number, number, number];
    const pivot = new Group();
    pivot.name = `${rotor.name}-pivot`;
    pivot.position.set(x, y, z);
    pivot.userData.spinDirection = rotor.userData.spinDirection ?? -1;
    rotor.parent?.add(pivot);
    pivot.add(rotor);
    rotor.position.sub(pivot.position);
  }
}

/**
 * The per-frame work on a loaded model: turning the rotor pivots
 * `mountRotors` made and, on a schematic, easing each component's look (see
 * `stepLooks`). Returns the ref to hang on the `<primitive>`. Everything is
 * reached through that ref each frame rather than kept from the memo, so the
 * only thing mutated is what a ref hands back - which is also why the ref is
 * made here and not passed in: the React Compiler treats a hook's arguments as
 * frozen.
 */
function useModelMotion(
  spin: boolean,
  highlight: HighlightOptions | null = null,
) {
  const ref = useRef<Object3D>(null);
  const invalidate = useThree((state) => state.invalidate);
  const lit = highlight?.part ?? null;
  // /lab renders on demand whenever its props are not spinning, so a change
  // of selection has to ask for the frames that ease it in.
  useEffect(() => {
    invalidate();
  }, [lit, invalidate]);

  useFrame((_, delta) => {
    const root = ref.current;
    if (!root) return;
    if (spin) {
      for (const child of root.children) {
        const direction = child.userData.spinDirection;
        if (typeof direction === 'number') child.rotation.y += direction * delta * SPIN_RATE;
      }
    }
    if (highlight && stepLooks(root, highlight, delta)) invalidate();
  });
  return ref;
}

/** Disposes only what a converter created - never the cached source scene. */
function useDisposeOnUnmount(object: Object3D) {
  useEffect(() => {
    return () => {
      object.traverse((child: Object3D) => {
        if (child instanceof LineSegments) {
          child.geometry.dispose();
          (child.material as Material).dispose();
        } else if (child instanceof Mesh) {
          (child.material as Material).dispose();
        }
      });
    };
  }, [object]);
}

export function SchematicModel({
  url,
  span,
  color,
  fillOpacity = 0.14,
  edgeOpacity = 0.55,
  threshold = 24,
  anchor = 'centre',
  spin = false,
  highlight = null,
  instant = false,
}: {
  url: string;
  /** Longest bounding-box dimension after scaling, in world units. */
  span: number;
  color: string;
  fillOpacity?: number;
  edgeOpacity?: number;
  /** Crease angle for the edge pass. Higher means fewer, more structural lines. */
  threshold?: number;
  /** `floor` sits the model on y = 0; `centre` puts its centre at the origin. */
  anchor?: Anchor;
  /** As on PbrModel: turns nodes the asset marks with a `spinPivot`. */
  spin?: boolean;
  /**
   * A component id (a node's `extras.part`, see scripts/obj-to-glb.mjs) to
   * light up; everything else fades back. `null` shows the model evenly.
   */
  highlight?: string | null;
  /** Snap between looks instead of fading - pass reduced motion here. */
  instant?: boolean;
}) {
  const { scene } = useGLTF(url, false);

  const object = useMemo(() => {
    // Cloned per instance: `useGLTF` caches one scene graph per URL, and two
    // components mounting the same model must not share (or mutate) it.
    const root = scene.clone(true);
    mountRotors(root);

    // One fill and one stroke per component (`extras.part`), so a component
    // can be lit and the rest faded without rebuilding any geometry. A model
    // with no parts ends up with the single pair it always had.
    const looks = new Map<string, Look>();
    const lookFor = (part: string) => {
      let look = looks.get(part);
      if (!look) {
        look = {
          fill: new MeshBasicMaterial({ color, transparent: true, opacity: fillOpacity }),
          stroke: new LineBasicMaterial({ color, transparent: true, opacity: edgeOpacity }),
          lines: [],
        };
        looks.set(part, look);
      }
      return look;
    };

    root.traverse((child: Object3D) => {
      if (!(child instanceof Mesh)) return;
      const look = lookFor(partOf(child));
      child.material = look.fill;
      child.castShadow = false;
      child.receiveShadow = false;
      // EdgesGeometry is built once here rather than by drei's <Edges>, which
      // would need a JSX child inside a mesh we never write as JSX.
      const lines = new LineSegments(
        new EdgesGeometry(child.geometry as BufferGeometry, threshold),
        look.stroke,
      );
      look.lines.push(lines);
      child.add(lines);
    });

    root.userData.looks = looks;
    normalise(root, span, anchor);
    return root;
  }, [scene, span, color, fillOpacity, edgeOpacity, threshold, anchor]);

  useDisposeOnUnmount(object);
  const ref = useModelMotion(spin, {
    part: highlight,
    fillOpacity,
    edgeOpacity,
    instant,
  });

  return <primitive ref={ref} object={object} />;
}

type Look = {
  fill: MeshBasicMaterial;
  stroke: LineBasicMaterial;
  lines: LineSegments[];
};

/** The component a mesh belongs to: its own or its nearest ancestor's `part`. */
function partOf(object: Object3D): string {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (typeof o.userData.part === 'string') return o.userData.part;
  }
  return '';
}

type HighlightOptions = {
  part: string | null;
  fillOpacity: number;
  edgeOpacity: number;
  instant: boolean;
};

/**
 * One frame of easing each component's look toward its target. Returns true
 * while anything is still moving.
 *
 * Lit component: brighter fill, full-strength edges drawn over everything
 * (depthTest off), so it reads even when it sits inside the frame. The rest:
 * faded to a ghost, and no longer writing depth, so it cannot hide the lit
 * part behind a transparent surface. Eases rather than cuts unless `instant`.
 */
function stepLooks(root: Object3D, options: HighlightOptions, delta: number) {
  const looks = root.userData.looks as Map<string, Look> | undefined;
  if (!looks || looks.size < 2) return false;
  const { part: highlight, fillOpacity, edgeOpacity, instant } = options;
  const k = instant ? 1 : 1 - Math.exp(-delta * 10);
  let easing = false;
  for (const [part, look] of looks) {
    const lit = highlight !== null && part === highlight;
    const dim = highlight !== null && !lit;
    const fillTarget = lit ? Math.max(0.3, fillOpacity) : dim ? fillOpacity * 0.3 : fillOpacity;
    const edgeTarget = lit ? 1 : dim ? edgeOpacity * 0.16 : edgeOpacity;
    for (const [material, target] of [
      [look.fill, fillTarget],
      [look.stroke, edgeTarget],
    ] as const) {
      const next = material.opacity + (target - material.opacity) * k;
      material.opacity = Math.abs(target - next) < 0.003 ? target : next;
      if (material.opacity !== target) easing = true;
    }
    look.fill.depthWrite = !dim;
    look.stroke.depthWrite = !dim;
    look.stroke.depthTest = !lit;
    for (const lines of look.lines) lines.renderOrder = lit ? 2 : 0;
  }
  return easing;
}

export function PbrModel({
  url,
  span,
  anchor = 'centre',
  tint,
  spin = false,
}: {
  url: string;
  span: number;
  anchor?: Anchor;
  /**
   * Turns any node the asset marks with a `spinPivot` - the props, on a craft
   * exported through scripts/obj-to-glb.mjs. A model without one ignores it.
   * Callers pass `!reducedMotion`.
   */
  spin?: boolean;
  /**
   * Multiplied into every material's colour. Left off, the model renders as
   * authored - which is the point of this component and the normal case.
   *
   * It exists for one job: a stock asset that is correct but too loud for the
   * place it is going. Multiplying is the right operation because it cannot
   * invent detail - it only takes light away, so a tinted model still has the
   * shading and texture the author gave it, just quieter.
   */
  tint?: string;
}) {
  const { scene } = useGLTF(url, false);

  const object = useMemo(() => {
    // Barely anything is converted here - the pipeline already emitted exactly
    // the material we want, and GLTFLoader has set up colour spaces correctly.
    // Size, origin and (optionally) how loud it is are ours to decide.
    const root = scene.clone(true);
    mountRotors(root);

    root.traverse((child: Object3D) => {
      if (!(child instanceof Mesh)) return;
      // No shadow maps in this scene: a single directional light plus the
      // environment reads well enough, and shadows on a craft with nothing
      // beneath it but a ground plate buy nothing.
      child.castShadow = false;
      child.receiveShadow = false;

      if (!tint) return;
      // Cloned, because the cached source scene's materials are shared with
      // every other mount of this URL and must not be recoloured under them.
      const material = (
        child.material as Material
      ).clone() as MeshBasicMaterial;
      material.color.set(tint);
      child.material = material;
    });

    normalise(root, span, anchor);
    return root;
  }, [scene, span, anchor, tint]);

  // Without a tint the materials belong to the cached source scene and must
  // not be disposed; with one they are ours and the shared helper collects
  // them. `useDisposeOnUnmount` walks meshes, so it handles exactly that case.
  useDisposeOnUnmount(tint ? object : EMPTY);

  const ref = useModelMotion(spin);

  return <primitive ref={ref} object={object} />;
}

/** Nothing to dispose. A stable identity, so the effect does not re-run. */
const EMPTY = new Object3DImpl();

// Nothing is preloaded here. Each craft preloads itself next to the component
// that flies it (DroneModel.tsx, lab/LabCraft.tsx), so a scene only fetches
// the craft it shows. Scenery is not preloaded - it can arrive late.
