/**
 * Flight model for the lab.
 *
 * A separate model from `flight.ts` rather than the same one with different
 * constants, for two reasons. The envelope is not a tuning difference — 2.2 m/s
 * in a 14 m room against 17 m/s in a 120 m world is a different machine, and
 * pretending otherwise would mean one file full of conditionals. And this one
 * has to collide, which the outdoor model deliberately does not.
 *
 * Same shape as its sibling: a velocity chasing a target velocity, with enough
 * lag to produce a visible lean. No thrust, no mass, no aerodynamics.
 */

import { COLLIDERS, ROOM, type Box } from './lab';
import type { FlightInput } from './flight';

/**
 * Walking pace. The room is 14 m end to end; at the outdoor model's 17 m/s you
 * cross it in under a second, which is not flying, it is teleporting into a
 * wall.
 */
const MAX_SPEED = 2.2;
const MAX_CLIMB = 1.3;
const YAW_RATE = 1.5;
/** Lower than outdoors: indoors you want it to stop roughly where you let go. */
const RESPONSE = 0.22;

/**
 * The craft as a sphere, in metres. The VT-802 renders at 0.4 m across in
 * here, so this is a little generous — deliberately. A collision radius
 * slightly larger than the visible craft means you stop just before touching
 * something, which reads as careful piloting; slightly smaller means you visibly
 * clip into a wall before the collision fires, which reads as a bug.
 */
export const CRAFT_RADIUS = 0.26;

type Vec3 = [number, number, number];

const overlaps = (x: number, y: number, z: number, box: Box, pad: number) => {
  const [cx, cy, cz] = box.centre;
  const [sx, sy, sz] = box.size;
  return (
    Math.abs(x - cx) < sx / 2 + pad &&
    Math.abs(y - cy) < sy / 2 + pad &&
    Math.abs(z - cz) < sz / 2 + pad
  );
};

const blocked = (x: number, y: number, z: number) =>
  COLLIDERS.some((box) => overlaps(x, y, z, box, CRAFT_RADIUS));

export class LabDrone {
  x: number;
  y: number;
  z: number;
  yaw: number;

  vx = 0;
  vy = 0;
  vz = 0;

  tiltPitch = 0;
  tiltRoll = 0;

  /** True on the frame a move was refused — the scene uses it for feedback. */
  bumped = false;

  constructor() {
    [this.x, this.y, this.z] = ROOM.spawn;
    this.yaw = ROOM.spawnYaw;
  }

  step(dt: number, input: FlightInput): void {
    const step = Math.min(dt, 0.05);
    const blend = 1 - Math.exp(-step / RESPONSE);

    this.yaw += input.yaw * YAW_RATE * step;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);

    const targetVx = (input.pitch * -sin + input.roll * cos) * MAX_SPEED;
    const targetVz = (input.pitch * -cos - input.roll * sin) * MAX_SPEED;
    const targetVy = input.lift * MAX_CLIMB;

    this.vx += (targetVx - this.vx) * blend;
    this.vy += (targetVy - this.vy) * blend;
    this.vz += (targetVz - this.vz) * blend;

    this.bumped = false;
    // Resolved one axis at a time, and this is the whole trick: moving on all
    // three at once and rejecting the result would stick you to a wall you
    // brushed. Per-axis, a refused X leaves Y and Z free, so you slide along
    // the surface instead — which is what every player expects without ever
    // being able to say why.
    this.x = this.tryAxis('x', this.x + this.vx * step);
    this.y = this.tryAxis('y', this.y + this.vy * step);
    this.z = this.tryAxis('z', this.z + this.vz * step);

    const localForward = (-this.vx * sin - this.vz * cos) / MAX_SPEED;
    const localRight = (this.vx * cos - this.vz * sin) / MAX_SPEED;
    this.tiltPitch += (localForward * 0.3 - this.tiltPitch) * blend;
    this.tiltRoll += (-localRight * 0.3 - this.tiltRoll) * blend;
  }

  private tryAxis(axis: 'x' | 'y' | 'z', value: number): number {
    const { min, max } = ROOM.bounds;
    const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const clamped = Math.max(min[index], Math.min(max[index], value));

    const candidate: Vec3 = [this.x, this.y, this.z];
    candidate[index] = clamped;

    if (blocked(candidate[0], candidate[1], candidate[2])) {
      // Refused: kill the velocity on this axis only, or the craft strains
      // against the obstacle and shoots away the moment it clears the edge.
      if (axis === 'x') this.vx = 0;
      else if (axis === 'y') this.vy = 0;
      else this.vz = 0;
      this.bumped = true;
      return this[axis];
    }

    if (clamped !== value) {
      if (axis === 'x') this.vx = 0;
      else if (axis === 'y') this.vy = 0;
      else this.vz = 0;
      this.bumped = true;
    }

    return clamped;
  }

  /**
   * Puts the craft at a station's approach anchor, facing the object.
   *
   * This is the accessible route to every station: the jump list under the
   * canvas calls it, so nothing in the room is reachable only by flying well.
   * If an anchor has been placed badly and lands inside something solid, the
   * craft is nudged back along the approach until it is clear rather than
   * being left stuck — a jump that strands you is worse than one that lands
   * you a little short.
   */
  moveTo(anchor: Vec3, facing: Vec3): void {
    const [ax, ay, az] = anchor;
    this.yaw = Math.atan2(-(facing[0] - ax), -(facing[2] - az));

    let x = ax;
    const y = ay;
    let z = az;
    const dx = ax - facing[0];
    const dz = az - facing[2];
    const length = Math.hypot(dx, dz) || 1;

    for (let i = 0; i < 12 && blocked(x, y, z); i += 1) {
      x += (dx / length) * 0.25;
      z += (dz / length) * 0.25;
    }

    const { min, max } = ROOM.bounds;
    this.x = Math.max(min[0], Math.min(max[0], x));
    this.y = Math.max(min[1], Math.min(max[1], y));
    this.z = Math.max(min[2], Math.min(max[2], z));
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vy, this.vz);
  }
}
