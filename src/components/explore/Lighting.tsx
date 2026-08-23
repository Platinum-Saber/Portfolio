'use client';

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * The lighting rig, shared by both 3D scenes on this route.
 *
 * Outdoors it lights exactly one object — the craft — against a world of unlit
 * wireframe. Indoors it lights everything, because the lab is PBR throughout.
 * The rig is the same either way, which is the reason it lives in its own
 * file: the environment map is the load-bearing part and it should not be
 * possible to build a scene that forgets it.
 *
 * The craft is metal, and metal shows you its surroundings rather than a
 * colour of its own — point every lamp you own at a metallic material with no
 * environment map and it still renders very nearly black. So the scene needs
 * an environment, and the cheapest honest one is `RoomEnvironment`: procedural
 * geometry with emissive panels, prefiltered once into a cube map. It is code,
 * not a downloaded HDR, so it costs nothing on the wire and cannot fail to
 * load.
 *
 * Built once on mount and disposed on unmount — PMREM allocates a render
 * target, and remaking it per frame would be a leak with a framerate.
 *
 * The two lights on top of it are for shape, not brightness: the environment
 * alone lights the craft evenly from all sides, which is legible but flat and
 * makes it hard to read attitude while flying. The key gives the hull a bright
 * side, and the dim blue fill keeps the shadow side from going to black
 * against a dark world.
 *
 * Nothing else in the scene notices any of this. Every other object is
 * `MeshBasicMaterial`, which ignores lights entirely.
 */
export function Lighting({
  keyIntensity = 2.6,
  fillIntensity = 0.8,
}: {
  keyIntensity?: number;
  fillIntensity?: number;
} = {}) {
  const gl = useThree((state) => state.gl);

  const environment = useMemo(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    pmrem.dispose();
    room.dispose();
    return target;
  }, [gl]);

  useEffect(() => () => environment.dispose(), [environment]);

  return (
    <>
      {/* Attached declaratively rather than assigned onto `scene`: the same
          result, and it is the scene graph's business to own it, not ours.
          Its strength is set once via the Canvas `scene` prop below. */}
      <primitive object={environment.texture} attach="environment" />
      <directionalLight position={[12, 18, 8]} intensity={keyIntensity} />
      <directionalLight
        position={[-10, 4, -12]}
        intensity={fillIntensity}
        color="#7fa8d0"
      />
    </>
  );
}
