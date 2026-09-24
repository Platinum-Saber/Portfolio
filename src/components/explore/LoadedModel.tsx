'use client';

import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import {
  Box3,
  EdgesGeometry,
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
}) {
  const { scene } = useGLTF(url, false);

  const object = useMemo(() => {
    // Cloned per instance: `useGLTF` caches one scene graph per URL, and two
    // components mounting the same model must not share (or mutate) it.
    const root = scene.clone(true);

    const fill = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: fillOpacity,
    });
    const stroke = new LineBasicMaterial({
      color,
      transparent: true,
      opacity: edgeOpacity,
    });

    root.traverse((child: Object3D) => {
      if (!(child instanceof Mesh)) return;
      child.material = fill;
      child.castShadow = false;
      child.receiveShadow = false;
      // EdgesGeometry is built once here rather than by drei's <Edges>, which
      // would need a JSX child inside a mesh we never write as JSX.
      child.add(
        new LineSegments(
          new EdgesGeometry(child.geometry as BufferGeometry, threshold),
          stroke,
        ),
      );
    });

    normalise(root, span, anchor);
    return root;
  }, [scene, span, color, fillOpacity, edgeOpacity, threshold, anchor]);

  useDisposeOnUnmount(object);

  return <primitive object={object} />;
}

export function PbrModel({
  url,
  span,
  anchor = 'centre',
  tint,
}: {
  url: string;
  span: number;
  anchor?: Anchor;
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

  return <primitive object={object} />;
}

/** Nothing to dispose. A stable identity, so the effect does not re-run. */
const EMPTY = new Object3DImpl();

// The craft is on screen before anything else and must never be the thing a
// visitor waits for. Scenery is not preloaded - it can arrive late.
useGLTF.preload('/models/vt-802.glb', false);
