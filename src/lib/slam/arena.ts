/**
 * The world the scouts are mapping.
 *
 * Walls are line segments in metres, and a scan is a raycast against all of
 * them. That is the entire physics model - there is no mesh, no collision
 * library and no physics engine, because a 2D LiDAR only ever asks one
 * question: along this bearing, how far until something is in the way.
 *
 * The layout is designed, not arbitrary. The central spine splits the arena
 * into two halves that a single scout cannot see across, so each robot
 * naturally maps a region the other has never observed. That is what makes the
 * merge worth doing - if both scouts saw the same room, fusing their maps would
 * be a redundancy exercise rather than the point of the project.
 */

export type Segment = {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
};

/** Half-width of the arena in metres; it spans -SIZE..SIZE on both axes. */
export const ARENA_HALF = 6;

function box(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rotation = 0,
): Segment[] {
  const hw = w / 2;
  const hh = h / 2;
  const corners: Array<[number, number]> = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const placed = corners.map(([x, y]) => ({
    x: cx + x * cos - y * sin,
    y: cy + x * sin + y * cos,
  }));
  return placed.map((point, index) => {
    const next = placed[(index + 1) % placed.length];
    return { x1: point.x, y1: point.y, x2: next.x, y2: next.y };
  });
}

export const ARENA: readonly Segment[] = [
  // Outer walls.
  ...box(0, 0, ARENA_HALF * 2, ARENA_HALF * 2),

  // The spine - a divider with a single doorway, so the two halves are only
  // connected through one gap. Built as two segments with a hole between them.
  { x1: 0, y1: -ARENA_HALF, x2: 0, y2: -1.2 },
  { x1: 0, y1: 1.2, x2: 0, y2: ARENA_HALF },

  // Obstacles in the west half.
  ...box(-3.6, 2.6, 2.2, 1.1),
  ...box(-2.2, -2.9, 1.0, 2.4, 0.35),
  ...box(-4.6, -0.6, 1.2, 1.2, 0.8),

  // Obstacles in the east half - deliberately a different character, so the
  // two local maps look distinct enough that a misalignment is obvious.
  ...box(3.2, 3.1, 1.4, 1.4, 0.5),
  ...box(4.3, -1.4, 1.0, 3.6),
  ...box(1.9, -3.7, 2.6, 0.8),
];

export type Ray = { ox: number; oy: number; dx: number; dy: number };

/**
 * Distance from a ray origin to the nearest wall, or `maxRange` if the ray
 * escapes. Direction must be unit length.
 *
 * Plain segment-intersection over every wall. With ~40 segments and ~90 rays
 * this is a few thousand operations per scan, which is nothing - spatial
 * indexing here would be optimising the cheapest part of the frame.
 */
export function castRay(ray: Ray, maxRange: number): number {
  let nearest = maxRange;

  for (const wall of ARENA) {
    const sx = wall.x2 - wall.x1;
    const sy = wall.y2 - wall.y1;

    const denominator = ray.dx * sy - ray.dy * sx;
    // Parallel: either no intersection, or collinear, which we ignore because
    // a LiDAR grazing exactly along a wall returns nothing useful anyway.
    if (Math.abs(denominator) < 1e-9) continue;

    const qx = wall.x1 - ray.ox;
    const qy = wall.y1 - ray.oy;

    // t is distance along the ray, u is position along the wall segment.
    const t = (qx * sy - qy * sx) / denominator;
    const u = (qx * ray.dy - qy * ray.dx) / denominator;

    if (t > 0 && t < nearest && u >= 0 && u <= 1) {
      nearest = t;
    }
  }

  return nearest;
}

/** True when a point is inside a wall or outside the arena - used to keep the scouts honest. */
export function isBlocked(x: number, y: number, clearance: number): boolean {
  if (
    Math.abs(x) > ARENA_HALF - clearance ||
    Math.abs(y) > ARENA_HALF - clearance
  ) {
    return true;
  }

  for (const wall of ARENA) {
    // Distance from the point to the segment.
    const sx = wall.x2 - wall.x1;
    const sy = wall.y2 - wall.y1;
    const lengthSquared = sx * sx + sy * sy;
    if (lengthSquared < 1e-12) continue;

    let t = ((x - wall.x1) * sx + (y - wall.y1) * sy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const nx = wall.x1 + t * sx - x;
    const ny = wall.y1 + t * sy - y;
    if (nx * nx + ny * ny < clearance * clearance) return true;
  }

  return false;
}
