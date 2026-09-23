/**
 * The RoboKeeper problem, reduced to the part worth showing.
 *
 * A ball is kicked at the goal. A depth camera beside the goal sees it exactly
 * twice — once as it crosses a far gate, once at a near gate — and each of
 * those sightings is a noisy 3D position, because depth cameras are. From two
 * noisy dots the keeper has to work out where the ball will cross the goal
 * line, and swing there before it arrives.
 *
 * Two estimators run on the same pair of measurements:
 *
 *   - `line`: a straight line through the two points. No gravity. This is the
 *     obvious thing, and it aims high, because a real shot is falling.
 *   - `ekf`: the project's Extended Kalman Filter — six states (position and
 *     velocity), gravity in the motion model — initialised from the two
 *     points, then marched forward to the goal plane.
 *
 * Everything here is deterministic given a seed, so a run can be reproduced.
 * Physics is plain ballistics: no drag, no spin. Both are real and both would
 * make the true path differ from the model the filter assumes; leaving them
 * out keeps the honest part (measurement noise, and the cost of assuming a
 * straight line) legible.
 */

import { makeSeededRandom } from '../random';

/** m/s². */
export const GRAVITY = 9.81;

/** Where the ball is kicked from, metres in front of the goal line. */
export const LAUNCH_Z = 6.5;
/** Ball height at the kick. */
export const LAUNCH_Y = 0.12;

/** Goal mouth, metres. Roughly the exhibition stand's. */
export const GOAL_HALF_WIDTH = 1.2;
export const GOAL_HEIGHT = 1.25;

/** Football radius, metres — a size 4 ball. */
export const BALL_RADIUS = 0.105;

/**
 * The keeper is an arm pivoting about the goal's centre, like the real servo,
 * and its length is not a free choice: swung to either top corner it has to
 * just reach the mouth's diagonal, less the ball's radius — a ball whose
 * centre is that far out is still touching the arm, so anything longer is arm
 * outside the goal and anything shorter leaves the corners unreachable.
 */
export const ARM_LENGTH =
  Math.hypot(GOAL_HALF_WIDTH, GOAL_HEIGHT) - BALL_RADIUS;
/** How close the arm has to be to the ball to count as a save. */
export const SAVE_RADIUS = 0.26;
/** Servo travel from vertical, radians. */
export const ARM_LIMIT = Math.PI / 2;
/** Servo slew rate, rad/s — an MG996R-class hobby servo under load. */
export const ARM_SLEW = (360 * Math.PI) / 180;

export type Vec3 = { x: number; y: number; z: number };

export type Estimator = 'ekf' | 'line';

export type ShotSpec = {
  /** Where the kicker is aiming, on the goal plane. */
  aimX: number;
  aimY: number;
  /** Ball speed toward the goal, m/s. */
  speed: number;
};

export type Settings = {
  /** Standard deviation of the camera's position error, metres. */
  noise: number;
  /** Gate distances from the goal line, metres. far > near. */
  farGate: number;
  nearGate: number;
  estimator: Estimator;
};

export type Measurement = { at: Vec3; truth: Vec3; t: number };

export type Prediction = {
  /** Where this estimator thinks the ball crosses the goal plane. */
  crossing: { x: number; y: number };
  /** Sampled path to the goal plane, for drawing. */
  path: Vec3[];
  /** Servo angle it asks for, radians from vertical. */
  angle: number;
};

export type ShotOutcome = {
  /** Where the ball actually crossed. */
  truth: { x: number; y: number };
  onTarget: boolean;
  /** Metres between the acting estimator's crossing and the truth. */
  error: number;
  /** Both estimators' error, so the comparison is always on screen. */
  ekfError: number;
  lineError: number;
  saved: boolean;
  /** Why a save failed, when it did. */
  reason: 'saved' | 'missed-prediction' | 'too-slow' | 'off-target';
};

export type Phase = 'ready' | 'flight' | 'settled';

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Ballistic position at time t for a launch state. */
function flight(p0: Vec3, v0: Vec3, t: number): Vec3 {
  return {
    x: p0.x + v0.x * t,
    y: p0.y + v0.y * t - 0.5 * GRAVITY * t * t,
    z: p0.z + v0.z * t,
  };
}

/**
 * Box–Muller, on top of the seeded generator. `random.ts` gives uniforms; a
 * camera's error is much better described by a normal, and using a uniform
 * here would make the noise slider lie about what it costs.
 */
function makeGaussian(random: () => number) {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const u = Math.max(random(), 1e-9);
    const v = random();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };
}

/** Angle the arm must hold to intercept a point on the goal plane. */
export function armAngle(x: number, y: number): number {
  // Measured from straight up, positive toward +x, and clamped to the servo's
  // travel — a prediction outside the post is still only worth 90°.
  return clamp(Math.atan2(x, Math.max(y, 0.05)), -ARM_LIMIT, ARM_LIMIT);
}

/** Distance from a goal-plane point to the arm's swept segment. */
function armMiss(angle: number, x: number, y: number): number {
  // Arm runs from the pivot at the goal's centre out to ARM_LENGTH.
  const tipX = Math.sin(angle) * ARM_LENGTH;
  const tipY = Math.cos(angle) * ARM_LENGTH;
  const len2 = tipX * tipX + tipY * tipY;
  const t = clamp((x * tipX + y * tipY) / len2, 0, 1);
  return Math.hypot(x - tipX * t, y - tipY * t);
}

/* ------------------------------------------------------------------ *
 * The two estimators
 * ------------------------------------------------------------------ */

function samplePath(p0: Vec3, v0: Vec3, gravity: number): Prediction {
  // March to the goal plane (z = 0) and stop there.
  const path: Vec3[] = [];
  const step = 0.01;
  let t = 0;
  let last = p0;
  for (; t < 2; t += step) {
    const p = {
      x: p0.x + v0.x * t,
      y: p0.y + v0.y * t - 0.5 * gravity * t * t,
      z: p0.z + v0.z * t,
    };
    if (p.z <= 0) {
      // Interpolate the exact crossing rather than the first sample past it.
      const span = last.z - p.z;
      const f = span > 1e-9 ? last.z / span : 0;
      const crossing = {
        x: last.x + (p.x - last.x) * f,
        y: last.y + (p.y - last.y) * f,
      };
      path.push({ ...crossing, z: 0 });
      return { crossing, path, angle: armAngle(crossing.x, crossing.y) };
    }
    path.push(p);
    last = p;
  }
  const crossing = { x: last.x, y: last.y };
  return { crossing, path, angle: armAngle(crossing.x, crossing.y) };
}

/** Straight line through the two sightings. The naive baseline. */
function predictLine(a: Measurement, b: Measurement): Prediction {
  const dt = Math.max(b.t - a.t, 1e-6);
  const v = {
    x: (b.at.x - a.at.x) / dt,
    y: (b.at.y - a.at.y) / dt,
    z: (b.at.z - a.at.z) / dt,
  };
  return samplePath(b.at, v, 0);
}

/**
 * The EKF, as the project runs it: six states, gravity in `f`, position-only
 * measurements. With two sightings the filter is initialised from the pair and
 * updated on the second, then predicted forward under gravity.
 *
 * The Jacobian of this motion model is constant (position integrates velocity,
 * velocity is constant bar gravity), so the "extended" part costs nothing here
 * — it is what lets the same filter carry a non-linear measurement model when
 * one is needed.
 */
function predictEkf(a: Measurement, b: Measurement, noise: number): Prediction {
  const dt = Math.max(b.t - a.t, 1e-6);

  // State: [x, y, z, vx, vy, vz]. Seeded from the two points, with the
  // gravity term folded back in so the initial velocity is the velocity at
  // the FIRST sighting rather than an average over the interval.
  let state = [
    a.at.x,
    a.at.y,
    a.at.z,
    (b.at.x - a.at.x) / dt,
    (b.at.y - a.at.y) / dt + 0.5 * GRAVITY * dt,
    (b.at.z - a.at.z) / dt,
  ];

  const r = Math.max(noise, 0.005) ** 2;
  // Position is known to about the sensor's accuracy; velocity from a
  // difference of two noisy points is worse by 2σ²/dt².
  let P = [
    r,
    r,
    r,
    (2 * r) / (dt * dt),
    (2 * r) / (dt * dt),
    (2 * r) / (dt * dt),
  ];
  const q = [1e-4, 1e-4, 1e-4, 1e-2, 1e-2, 1e-2];

  // Predict to the second sighting.
  const predict = (h: number) => {
    state = [
      state[0] + state[3] * h,
      state[1] + state[4] * h - 0.5 * GRAVITY * h * h,
      state[2] + state[5] * h,
      state[3],
      state[4] - GRAVITY * h,
      state[5],
    ];
    // Diagonal covariance propagation: P_pos += h²·P_vel, plus process noise.
    P = [
      P[0] + h * h * P[3] + q[0],
      P[1] + h * h * P[4] + q[1],
      P[2] + h * h * P[5] + q[2],
      P[3] + q[3],
      P[4] + q[4],
      P[5] + q[5],
    ];
  };

  predict(dt);

  // Update on the measured position, one axis at a time. The measurement
  // model is position-only, so the gain is scalar per axis: how much to
  // believe this sighting over where the filter thought the ball would be.
  const z = [b.at.x, b.at.y, b.at.z];
  for (let i = 0; i < 3; i += 1) {
    const gain = P[i] / (P[i] + r);
    state[i] += gain * (z[i] - state[i]);
    P[i] *= 1 - gain;
  }

  return samplePath(
    { x: state[0], y: state[1], z: state[2] },
    { x: state[3], y: state[4], z: state[5] },
    GRAVITY,
  );
}

/* ------------------------------------------------------------------ *
 * The simulation
 * ------------------------------------------------------------------ */

export type SimSnapshot = {
  phase: Phase;
  t: number;
  ball: Vec3;
  /** True path so far, for the trail. */
  trail: Vec3[];
  sightings: Measurement[];
  ekf: Prediction | null;
  line: Prediction | null;
  armAngle: number;
  outcome: ShotOutcome | null;
  /** Running tally since the last reset. */
  shots: number;
  saves: number;
};

export function createKeeperSim(seed = 20251007) {
  const random = makeSeededRandom(seed);
  const gauss = makeGaussian(random);

  let phase: Phase = 'ready';
  let t = 0;
  let p0: Vec3 = { x: 0, y: LAUNCH_Y, z: LAUNCH_Z };
  let v0: Vec3 = { x: 0, y: 0, z: 0 };
  let ball: Vec3 = { ...p0 };
  let trail: Vec3[] = [];
  let sightings: Measurement[] = [];
  let ekf: Prediction | null = null;
  let line: Prediction | null = null;
  let arm = 0;
  let armTarget = 0;
  let outcome: ShotOutcome | null = null;
  let settings: Settings = {
    noise: 0.04,
    farGate: 4.5,
    nearGate: 2.6,
    estimator: 'ekf',
  };
  let shots = 0;
  let saves = 0;
  let goalT = 0;

  function measure(zGate: number): Measurement {
    // z(t) is linear, so the crossing time is exact.
    const tGate = (p0.z - zGate) / -v0.z;
    const truth = flight(p0, v0, tGate);
    const n = settings.noise;
    return {
      t: tGate,
      truth,
      at: {
        x: truth.x + gauss() * n,
        y: truth.y + gauss() * n,
        // Depth is the weaker axis on a structured-light camera, so it gets
        // half again the error of the two image axes.
        z: truth.z + gauss() * n * 1.5,
      },
    };
  }

  return {
    get settings() {
      return settings;
    },

    configure(next: Partial<Settings>) {
      settings = { ...settings, ...next };
      // Re-deciding mid-flight is the point of the estimator toggle: the
      // keeper immediately heads for the other prediction.
      if (phase === 'flight') {
        const active = settings.estimator === 'ekf' ? ekf : line;
        if (active) armTarget = active.angle;
      }
    },

    /** Kick. Returns false if a ball is already in the air. */
    shoot(spec: ShotSpec) {
      if (phase === 'flight') return false;

      const speed = Math.max(spec.speed, 4);
      const flightTime = LAUNCH_Z / speed;

      p0 = { x: 0, y: LAUNCH_Y, z: LAUNCH_Z };
      v0 = {
        x: spec.aimX / flightTime,
        y:
          (spec.aimY - LAUNCH_Y + 0.5 * GRAVITY * flightTime * flightTime) /
          flightTime,
        z: -speed,
      };

      goalT = flightTime;
      t = 0;
      ball = { ...p0 };
      trail = [{ ...p0 }];
      sightings = [];
      ekf = null;
      line = null;
      outcome = null;
      phase = 'flight';
      // Back to neutral for each shot. A keeper that stayed where the last
      // prediction left it would sometimes be accidentally right, which would
      // quietly flatter the reaction-time story this page is making.
      armTarget = 0;
      shots += 1;
      return true;
    },

    reset() {
      phase = 'ready';
      t = 0;
      ball = { x: 0, y: LAUNCH_Y, z: LAUNCH_Z };
      trail = [];
      sightings = [];
      ekf = null;
      line = null;
      outcome = null;
      arm = 0;
      armTarget = 0;
      shots = 0;
      saves = 0;
    },

    step(dt: number) {
      if (phase === 'flight') {
        const previous = t;
        t = Math.min(t + dt, goalT);
        ball = flight(p0, v0, t);
        trail.push({ ...ball });
        if (trail.length > 400) trail.shift();

        const far = (p0.z - settings.farGate) / -v0.z;
        const near = (p0.z - settings.nearGate) / -v0.z;

        // Gate crossings. Both are measured the instant the ball passes them,
        // and the prediction only exists after the second.
        if (previous < far && t >= far && sightings.length === 0) {
          sightings.push(measure(settings.farGate));
        }
        if (previous < near && t >= near && sightings.length === 1) {
          sightings.push(measure(settings.nearGate));
          const [a, b] = sightings;
          ekf = predictEkf(a, b, settings.noise);
          line = predictLine(a, b);
          const active = settings.estimator === 'ekf' ? ekf : line;
          armTarget = active.angle;
        }

        if (t >= goalT) {
          const truth = { x: ball.x, y: ball.y };
          const onTarget =
            Math.abs(truth.x) <= GOAL_HALF_WIDTH &&
            truth.y <= GOAL_HEIGHT &&
            truth.y >= 0;
          const miss = armMiss(arm, truth.x, truth.y);
          // Did the servo finish its swing before the ball arrived? This is
          // the difference between "the maths was wrong" and "the maths was
          // right and late", and the page reports which.
          const settled = Math.abs(arm - armTarget) < 0.05;
          const saved = onTarget && miss <= SAVE_RADIUS;
          const dist = (p: Prediction | null) =>
            p
              ? Math.hypot(p.crossing.x - truth.x, p.crossing.y - truth.y)
              : NaN;

          if (saved) saves += 1;
          outcome = {
            truth,
            onTarget,
            error: dist(settings.estimator === 'ekf' ? ekf : line),
            ekfError: dist(ekf),
            lineError: dist(line),
            saved,
            reason: !onTarget
              ? 'off-target'
              : saved
                ? 'saved'
                : settled
                  ? 'missed-prediction'
                  : 'too-slow',
          };
          phase = 'settled';
        }
      }

      // The servo moves at a finite rate whatever the maths says, which is
      // why a prediction made too late is worth nothing.
      const delta = armTarget - arm;
      const travel = ARM_SLEW * dt;
      arm =
        Math.abs(delta) <= travel ? armTarget : arm + Math.sign(delta) * travel;
    },

    snapshot(): SimSnapshot {
      return {
        phase,
        t,
        ball,
        trail,
        sightings,
        ekf,
        line,
        armAngle: arm,
        outcome,
        shots,
        saves,
      };
    },
  };
}

export type KeeperSim = ReturnType<typeof createKeeperSim>;
