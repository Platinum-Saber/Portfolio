/**
 * Flight model for the explorer drone.
 *
 * Not a physics simulation — no thrust, no mass, no aerodynamics. It is a
 * velocity that chases a target velocity, which is the right amount of model
 * for a thing whose job is to carry a reader to a paragraph. What it does have
 * is inertia, because a drone that stops dead the instant you release a key
 * feels like a cursor rather than an aircraft, and the visible tilt that comes
 * from lag is most of what sells it as flying at all.
 *
 * Kept free of React and three.js so the behaviour can be reasoned about, and
 * corrected, without a renderer in the way.
 */

import { WORLD_HALF, ZONE_RADIUS } from './zones';

export type FlightInput = {
  /** −1 back … +1 forward, in the drone's own frame. */
  pitch: number;
  /** −1 left … +1 right, strafing. */
  roll: number;
  /** −1 down … +1 up. */
  lift: number;
  /** −1 clockwise … +1 anticlockwise. */
  yaw: number;
};

export const NEUTRAL: FlightInput = { pitch: 0, roll: 0, lift: 0, yaw: 0 };

/** Also the divisor the audio engine normalises craft speed against. */
export const MAX_SPEED = 17;
const MAX_CLIMB = 9;
const YAW_RATE = 1.7;
/** Seconds to reach roughly 63% of a new target velocity. Higher is floatier. */
const RESPONSE = 0.28;

/** Comfortably inside the trigger radius, with room to see the marker. */
export const ARRIVAL_STANDOFF = ZONE_RADIUS * 0.6;

export const MIN_ALTITUDE = 1.2;
export const MAX_ALTITUDE = 34;

export class Drone {
  x = 0;
  y = 7;
  z = 26;
  yaw = 0;

  vx = 0;
  vy = 0;
  vz = 0;

  /** Visual only: the body leans into whatever the velocity is doing. */
  tiltPitch = 0;
  tiltRoll = 0;

  step(dt: number, input: FlightInput): void {
    // Clamped so a backgrounded tab does not resume by teleporting the drone
    // through the boundary.
    const step = Math.min(dt, 0.05);

    this.yaw += input.yaw * YAW_RATE * step;

    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);

    // Forward is −Z at yaw 0, matching the camera's initial framing.
    const targetVx = (input.pitch * -sin + input.roll * cos) * MAX_SPEED;
    const targetVz = (input.pitch * -cos - input.roll * sin) * MAX_SPEED;
    const targetVy = input.lift * MAX_CLIMB;

    // Exponential approach, framerate-independent. A plain lerp by `dt` would
    // make the drone handle differently at 30 fps and 144 fps.
    const blend = 1 - Math.exp(-step / RESPONSE);
    this.vx += (targetVx - this.vx) * blend;
    this.vy += (targetVy - this.vy) * blend;
    this.vz += (targetVz - this.vz) * blend;

    this.x += this.vx * step;
    this.y += this.vy * step;
    this.z += this.vz * step;

    // The boundary bleeds off velocity instead of pinning the drone against an
    // invisible wall, which otherwise feels like a bug.
    const limit = WORLD_HALF - 2;
    if (this.x > limit || this.x < -limit) {
      this.x = Math.max(-limit, Math.min(limit, this.x));
      this.vx *= -0.25;
    }
    if (this.z > limit || this.z < -limit) {
      this.z = Math.max(-limit, Math.min(limit, this.z));
      this.vz *= -0.25;
    }
    if (this.y < MIN_ALTITUDE) {
      this.y = MIN_ALTITUDE;
      this.vy = 0;
    }
    if (this.y > MAX_ALTITUDE) {
      this.y = MAX_ALTITUDE;
      this.vy = 0;
    }

    this.lean(blend);
  }

  /**
   * Guided flight (9.2): put the craft where the guide says, and derive its
   * velocity from the move. The velocity matters twice over — the body leans
   * into it exactly as it does under manual control, and when the visitor
   * takes over, `step()` continues from it instead of from a standstill.
   */
  follow(x: number, y: number, z: number, yaw: number, dt: number): void {
    // Same 0.25 s ceiling the guide's clock uses, so a slow frame yields the
    // true velocity rather than one inflated by a mismatched clamp.
    const step = Math.max(Math.min(dt, 0.25), 1e-4);
    this.vx = (x - this.x) / step;
    this.vy = (y - this.y) / step;
    this.vz = (z - this.z) / step;
    this.x = x;
    this.y = y;
    this.z = z;
    this.yaw = yaw;
    this.lean(1 - Math.exp(-Math.min(step, 0.05) / RESPONSE));
  }

  /** Lean proportional to the velocity component in each body axis. Guided
   *  flight runs faster than MAX_SPEED, so the lean is capped rather than
   *  allowed to tip the craft past what manual flight ever shows. */
  private lean(blend: number): void {
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    const cap = (v: number) => Math.max(-1, Math.min(1, v));
    const localForward = cap((-this.vx * sin - this.vz * cos) / MAX_SPEED);
    const localRight = cap((this.vx * cos - this.vz * sin) / MAX_SPEED);
    this.tiltPitch += (localForward * 0.42 - this.tiltPitch) * blend;
    this.tiltRoll += (-localRight * 0.42 - this.tiltRoll) * blend;
  }

  /** Drops the drone next to a marker. Since 9.2 this is the
   *  `prefers-reduced-motion` branch only — everyone else is flown there. */
  teleport(target: [number, number, number]): void {
    const [tx, ty, tz] = target;
    // Approach from the south so the marker is in front of the camera on
    // arrival, but land *inside* ZONE_RADIUS. The first version stood off by
    // nine metres, two metres outside the trigger, so every jump arrived
    // looking at a marker that never opened — the accessible route to the
    // content quietly did not reach it.
    this.x = tx;
    this.y = ty;
    this.z = tz + ARRIVAL_STANDOFF;
    this.yaw = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vy, this.vz);
  }
}
