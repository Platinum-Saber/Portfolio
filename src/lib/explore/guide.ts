/**
 * Guided flight — Phase 9.2.
 *
 * A jump button no longer teleports the craft. It plans a route to the zone,
 * DRAWS it first (the waypoint ribbon, so the button's effect is legible
 * before anything moves), then flies the craft along it. The moment the
 * visitor touches a flight control the guide lets go and the craft keeps the
 * velocity it had, so taking over feels like grabbing the sticks mid-flight
 * rather than being dropped.
 *
 * Teleport survives as the `prefers-reduced-motion` branch only — handled by
 * the caller, which never starts a Guide in that case.
 *
 * Owns no renderer state: the scene reads `curve`, `drawn`, `progress` and
 * `opacity` to draw the ribbon, and `update()` hands back the pose the craft
 * should hold this frame, or null when the craft is its own again.
 */

import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import { ARRIVAL_STANDOFF, MAX_ALTITUDE } from './flight';
import { WORLD_HALF } from './zones';

/** Seconds the ribbon takes to draw itself before the craft moves. */
const DRAW_S = 0.55;
/** Seconds the ribbon takes to fade once the craft arrives or is taken over. */
const FADE_S = 0.7;
/**
 * Average guided speed. Deliberately faster than the 17 m/s a visitor can
 * fly: a guided jump is a shortcut, and crossing the world at manual speed
 * would make the button feel slower than flying it yourself.
 */
const GUIDED_SPEED = 30;
const MIN_FLIGHT_S = 1.4;
const MAX_FLIGHT_S = 4.2;
/** Final straight run into the zone, so the marker is ahead on arrival. */
const FINAL_APPROACH = 12;

export type GuidePhase = 'idle' | 'draw' | 'fly' | 'fade';
export type Pose = { x: number; y: number; z: number; yaw: number };

const tangent = new Vector3();

/** Yaw that faces along a direction; forward is −Z at yaw 0 (flight.ts). */
const headingOf = (dx: number, dz: number) => Math.atan2(-dx, -dz);

/** Shortest-way interpolation between two angles. */
function lerpAngle(a: number, b: number, t: number): number {
  const delta = MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;
  return a + delta * t;
}

/** Ease in and out, so the craft neither lurches away nor slams to a stop. */
const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

export class Guide {
  phase: GuidePhase = 'idle';
  curve: CatmullRomCurve3 | null = null;
  /** Zone id being flown to, while drawing or flying. */
  target: string | null = null;
  /** 0…1 — how much of the ribbon is drawn. */
  drawn = 0;
  /** 0…1 — the craft's position along the ribbon. */
  progress = 0;
  /** 0…1 — the ribbon's overall opacity. */
  opacity = 0;
  /** Bumped whenever a new route is planned, so the ribbon rebuilds once. */
  version = 0;

  private elapsed = 0;
  private duration = 0;
  private startYaw = 0;
  /** Heading the craft settles on as it arrives — along its approach. */
  private arrivalYaw = 0;

  get driving(): boolean {
    return this.phase === 'draw' || this.phase === 'fly';
  }

  start(
    id: string,
    from: [number, number, number],
    fromYaw: number,
    zone: [number, number, number],
  ): void {
    const [fx, fy, fz] = from;
    const [tx, ty, tz] = zone;
    const limit = WORLD_HALF - 4;

    // Arrive along the direction of travel, stopping short of the marker by
    // the teleport's standoff (inside ZONE_RADIUS, so the zone opens). The
    // teleport always came in from the south; copying that here made every
    // zone south of the craft a fly-past and a U-turn. What the rule was for —
    // the marker ahead of the chase camera on arrival — holds for any
    // direction, as long as the last stretch points at it.
    let dx = tx - fx;
    let dz = tz - fz;
    const flat = Math.hypot(dx, dz);
    if (flat < 1e-3) {
      dx = 0;
      dz = -1;
    } else {
      dx /= flat;
      dz /= flat;
    }
    const clampXZ = (v: Vector3) => {
      v.x = MathUtils.clamp(v.x, -limit, limit);
      v.z = MathUtils.clamp(v.z, -limit, limit);
      return v;
    };
    const arrive = clampXZ(
      new Vector3(tx - dx * ARRIVAL_STANDOFF, ty, tz - dz * ARRIVAL_STANDOFF),
    );
    this.arrivalYaw = headingOf(dx, dz);
    const points = [new Vector3(fx, fy, fz)];
    const distance = Math.hypot(tx - fx, ty - fy, tz - fz);

    if (distance > FINAL_APPROACH * 1.5) {
      // Lead-in point on the approach line, so the last stretch is a straight
      // run at the marker.
      const lead = clampXZ(
        new Vector3(
          arrive.x - dx * FINAL_APPROACH,
          ty + 1.5,
          arrive.z - dz * FINAL_APPROACH,
        ),
      );
      // Midpoint lifted into an arc: the route climbs over the world rather
      // than skimming it, which is both clearer to read and closer to how the
      // craft would actually be flown. The flight volume above ~12 m is
      // otherwise almost unused (DESIGN-LANGUAGE §9).
      const mid = new Vector3().lerpVectors(points[0], lead, 0.5);
      mid.y = Math.min(
        MAX_ALTITUDE - 2,
        Math.max(fy, lead.y) + Math.min(10, distance * 0.12),
      );
      points.push(mid, lead);
    }
    points.push(arrive);

    this.curve = new CatmullRomCurve3(points, false, 'centripetal');
    this.duration = MathUtils.clamp(
      this.curve.getLength() / GUIDED_SPEED,
      MIN_FLIGHT_S,
      MAX_FLIGHT_S,
    );
    this.target = id;
    this.startYaw = fromYaw;
    this.phase = 'draw';
    this.elapsed = 0;
    this.drawn = 0;
    this.progress = 0;
    this.opacity = 1;
    this.version += 1;
  }

  /** The visitor took the controls: stop driving, let the ribbon fade. */
  cancel(): void {
    if (!this.driving) return;
    this.phase = 'fade';
    this.target = null;
  }

  /** Advances the guide. Returns the pose the craft must hold, or null. */
  update(dt: number): Pose | null {
    const curve = this.curve;
    if (this.phase === 'idle' || !curve) return null;
    this.elapsed += dt;

    if (this.phase === 'fade') {
      this.opacity = Math.max(0, this.opacity - dt / FADE_S);
      if (this.opacity === 0) this.phase = 'idle';
      return null;
    }

    if (this.phase === 'draw') {
      this.drawn = ease(Math.min(1, this.elapsed / DRAW_S));
      // Hold position, but turn to face the route while it draws — the
      // craft visibly lines up before it goes.
      const origin = curve.getPointAt(0);
      curve.getTangentAt(0.02, tangent);
      const yaw = lerpAngle(
        this.startYaw,
        headingOf(tangent.x, tangent.z),
        this.drawn,
      );
      if (this.elapsed >= DRAW_S) {
        this.phase = 'fly';
        this.elapsed = 0;
        this.startYaw = yaw;
      }
      return { x: origin.x, y: origin.y, z: origin.z, yaw };
    }

    // fly
    const t = Math.min(1, this.elapsed / this.duration);
    const along = ease(t);
    this.progress = along;
    const point = curve.getPointAt(along);
    curve.getTangentAt(Math.min(along, 0.999), tangent);
    const flat = Math.hypot(tangent.x, tangent.z);
    let yaw = flat > 0.05 ? headingOf(tangent.x, tangent.z) : this.startYaw;
    // Settle onto the approach heading over the last fifth.
    yaw = lerpAngle(yaw, this.arrivalYaw, MathUtils.smoothstep(t, 0.8, 1));
    this.startYaw = yaw;

    if (t >= 1) {
      this.phase = 'fade';
      this.target = null;
    }
    return { x: point.x, y: point.y, z: point.z, yaw };
  }
}
