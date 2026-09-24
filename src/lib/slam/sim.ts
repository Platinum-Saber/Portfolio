/**
 * Two scouts, three maps, and the lie at the centre of the whole problem.
 *
 * Each scout knows where it *thinks* it is, which is not where it is. Wheel
 * odometry integrates its own error, so the believed pose drifts away from the
 * true one - slowly, and faster when turning, because rotational error is what
 * really hurts. Every scan the scout records is filed at the believed pose.
 *
 * That single detail produces everything worth showing here:
 *
 *   - each scout's own map is internally consistent but progressively wrong
 *     about the world's shape,
 *   - laying the two maps on top of each other without correction gives two
 *     ghosts of the same arena that refuse to line up,
 *   - and the fused map is only clean because something solved for the
 *     transform between those two mistaken frames.
 *
 * The real system streams scans and odometry over micro-ROS to a Raspberry Pi
 * coordinator, whose map-merger node builds one probabilistic grid. Here the
 * corrected map is built from the true poses - an honest stand-in for a solved
 * alignment, not a claim to have re-implemented the solver in a browser. The
 * page says so in as many words.
 */

import { makeSeededRandom } from '../random';
import { ARENA_HALF, castRay, isBlocked } from './arena';
import { OccupancyGrid } from './grid';

export const MAX_RANGE = 6;
const RAYS_PER_SCAN = 90;
const SCAN_INTERVAL = 0.1;
const BODY_RADIUS = 0.16;

export type Pose = { x: number; y: number; th: number };

/*
 * Noise here is seeded rather than Math.random on purpose: the unaligned view
 * is a teaching illustration, and it must not occasionally come out looking
 * almost correct. See src/lib/random.ts.
 */

export type ScanPoint = { x: number; y: number; hit: boolean };

export class Scout {
  readonly truth: Pose;
  readonly belief: Pose;
  readonly local: OccupancyGrid;
  readonly scan: ScanPoint[] = [];

  private random: () => number;
  private waypoints: Array<[number, number]>;
  private target = 0;
  private sinceScan = 0;
  private scanPhase = 0;

  constructor(
    readonly id: 'alpha' | 'bravo',
    start: Pose,
    waypoints: Array<[number, number]>,
    seed: number,
    /** Scales the odometry error. Bravo drifts harder - one bad wheel is realistic. */
    private readonly driftScale: number,
  ) {
    this.truth = { ...start };
    this.belief = { ...start };
    this.local = new OccupancyGrid(ARENA_HALF);
    this.waypoints = waypoints;
    this.random = makeSeededRandom(seed);
  }

  /** How far the scout's belief has wandered from reality, in metres. */
  get positionError(): number {
    return Math.hypot(
      this.truth.x - this.belief.x,
      this.truth.y - this.belief.y,
    );
  }

  /** Heading error in degrees - the one that does the real damage to a map. */
  get headingError(): number {
    let d = this.truth.th - this.belief.th;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return (d * 180) / Math.PI;
  }

  /** Autonomous patrol: steer toward the current waypoint, advance when reached. */
  private autopilot(): [number, number] {
    const [tx, ty] = this.waypoints[this.target];
    const dx = tx - this.truth.x;
    const dy = ty - this.truth.y;

    if (Math.hypot(dx, dy) < 0.35) {
      this.target = (this.target + 1) % this.waypoints.length;
    }

    let bearing = Math.atan2(dy, dx) - this.truth.th;
    while (bearing > Math.PI) bearing -= Math.PI * 2;
    while (bearing < -Math.PI) bearing += Math.PI * 2;

    // Slow down while turning hard, the way a differential-drive base does.
    const turn = Math.max(-1.6, Math.min(1.6, bearing * 2.4));
    const forward =
      Math.abs(bearing) > 1.0 ? 0 : 0.65 * (1 - Math.abs(bearing) / 1.4);
    return [forward, turn];
  }

  /**
   * @param drive `null` for autopilot, or a [forward m/s, turn rad/s] command.
   */
  step(
    dt: number,
    drive: [number, number] | null,
    mergedGrid: OccupancyGrid,
  ): void {
    const [forward, turn] = drive ?? this.autopilot();

    const dth = turn * dt;
    const ds = forward * dt;

    this.truth.th += dth;
    const nx = this.truth.x + Math.cos(this.truth.th) * ds;
    const ny = this.truth.y + Math.sin(this.truth.th) * ds;

    // Refuse to drive through a wall. Nudging the waypoint on along with it,
    // so an autopilot wedged in a corner does not stay wedged.
    if (!isBlocked(nx, ny, BODY_RADIUS)) {
      this.truth.x = nx;
      this.truth.y = ny;
    } else if (drive === null) {
      this.target = (this.target + 1) % this.waypoints.length;
    }
    // Note what happens when a scout is driven into a wall and held there: the
    // true pose stops, the believed pose below does not. That is not a bug in
    // the simulation, it is wheel slip, and it is the fastest way to wreck an
    // odometry estimate in real life. Holding W against a wall for a few
    // seconds tears the map visibly - the page invites you to try it.

    // The odometry the scout actually believes. Error scales with how much it
    // moved and, more sharply, with how much it turned.
    const noise = () => (this.random() * 2 - 1) * this.driftScale;
    this.belief.th +=
      dth * (1 + noise() * 0.09) + Math.abs(dth) * noise() * 0.11;
    const believedStep = ds * (1 + noise() * 0.05);
    this.belief.x += Math.cos(this.belief.th) * believedStep;
    this.belief.y += Math.sin(this.belief.th) * believedStep;

    this.sinceScan += dt;
    if (this.sinceScan >= SCAN_INTERVAL) {
      this.sinceScan = 0;
      this.takeScan(mergedGrid);
    }
  }

  /**
   * One LiDAR revolution's worth of beams, cast from the true pose - the
   * sensor cannot lie about what is in front of it - and then filed twice:
   * into the scout's own map at the believed pose, and into the fused map at
   * the corrected one.
   */
  private takeScan(mergedGrid: OccupancyGrid): void {
    this.scan.length = 0;

    // Offset each revolution slightly so beams do not land in the same cells
    // every time, which would leave permanent unobserved gaps between them.
    this.scanPhase = (this.scanPhase + 0.37) % 1;

    for (let i = 0; i < RAYS_PER_SCAN; i += 1) {
      const bearing = ((i + this.scanPhase) / RAYS_PER_SCAN) * Math.PI * 2;

      const worldAngle = this.truth.th + bearing;
      const dx = Math.cos(worldAngle);
      const dy = Math.sin(worldAngle);

      const range = castRay(
        { ox: this.truth.x, oy: this.truth.y, dx, dy },
        MAX_RANGE,
      );
      const didHit = range < MAX_RANGE;

      // A real LD19 is not this good; a little range noise keeps the walls from
      // looking suspiciously like the polygons they are.
      const measured = didHit
        ? range * (1 + (this.random() * 2 - 1) * 0.004)
        : MAX_RANGE;

      this.scan.push({
        x: this.truth.x + dx * measured,
        y: this.truth.y + dy * measured,
        hit: didHit,
      });

      // Into the scout's own map, at the pose it believes it occupies.
      const believedAngle = this.belief.th + bearing;
      this.local.integrateBeam(
        this.belief.x,
        this.belief.y,
        this.belief.x + Math.cos(believedAngle) * measured,
        this.belief.y + Math.sin(believedAngle) * measured,
        didHit,
      );

      // Into the fused map, at the corrected pose.
      mergedGrid.integrateBeam(
        this.truth.x,
        this.truth.y,
        this.truth.x + dx * measured,
        this.truth.y + dy * measured,
        didHit,
      );
    }
  }
}

export class SlamSim {
  readonly alpha: Scout;
  readonly bravo: Scout;
  readonly merged: OccupancyGrid;
  elapsed = 0;

  constructor() {
    // Each scout owns a half and pushes through the doorway into the other's
    // territory twice a lap.
    //
    // That overlap is the whole point and it took a rewrite to get right. The
    // first version kept the scouts strictly separated, which told the "fusion
    // buys you coverage" story well and the "misalignment is visible" story not
    // at all - with nothing mapped twice, there was no doubled wall to see, and
    // the unaligned view just looked like two tidy halves. The band around the
    // doorway is now surveyed by both, so their disagreement has somewhere to
    // show itself.
    this.alpha = new Scout(
      'alpha',
      { x: -4.6, y: -4.4, th: Math.PI / 2 },
      [
        [-4.8, 0.4],
        [-4.4, 4.6],
        [-1.4, 4.4],
        [-1.4, 0.6],
        // Through the gap - the divider only opens between y = -1.2 and 1.2,
        // so every crossing waypoint sits at y = ±0.6.
        [1.6, 0.6],
        [2.3, 1.8],
        [1.6, -0.6],
        [-1.4, -0.6],
        [-1.2, -4.4],
        [-4.6, -4.6],
      ],
      1337,
      1.5,
    );

    // Bravo mirrors the route from the east, and drifts noticeably harder -
    // one tired motor is all it takes.
    this.bravo = new Scout(
      'bravo',
      { x: 4.6, y: 4.4, th: -Math.PI / 2 },
      [
        [1.2, 4.4],
        [1.4, 0.6],
        [-1.6, 0.6],
        [-2.4, 1.6],
        [-1.6, -0.6],
        [1.4, -0.6],
        [1.0, -4.4],
        [4.6, -4.6],
        [5.0, -0.2],
        [4.6, 4.4],
      ],
      99173,
      2.6,
    );

    this.merged = new OccupancyGrid(ARENA_HALF);
  }

  /**
   * @param driving which scout the visitor has taken control of, if any
   * @param command their [forward, turn] input
   */
  step(
    dt: number,
    driving: 'alpha' | 'bravo' | null,
    command: [number, number],
  ): void {
    // Clamped so a dropped frame or a backgrounded tab cannot teleport a scout
    // through a wall when the page comes back.
    const clamped = Math.min(dt, 0.05);
    this.elapsed += clamped;

    this.alpha.step(clamped, driving === 'alpha' ? command : null, this.merged);
    this.bravo.step(clamped, driving === 'bravo' ? command : null, this.merged);
  }
}

/**
 * There is deliberately no `reset()` method. Restarting means restoring the
 * poses, the maps, *and* the position each scout's noise generator had reached -
 * and a reset that forgets the last of those would replay a different drift
 * every time, quietly breaking the one property this simulation depends on.
 * Constructing a new SlamSim is exact by definition.
 */
export function createSim(): SlamSim {
  return new SlamSim();
}
