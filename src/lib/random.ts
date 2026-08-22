/**
 * A small seeded pseudo-random generator, shared by anything that wants a world
 * that looks scattered but comes out the same on every visit.
 *
 * Determinism is not fussiness here. The SLAM drift illustration has to land
 * the same way every time or it stops teaching anything, and a skyline that
 * rearranged itself on each load would be a different place each visit. It also
 * keeps `Math.random` out of render paths, where an unstable value between
 * server and client is a hydration mismatch waiting to happen.
 *
 * Numerical recipes LCG. Not statistically strong, and it does not need to be —
 * nothing here is a simulation of chance, only a source of stable variety.
 */
export function makeSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
