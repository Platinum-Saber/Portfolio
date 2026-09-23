/**
 * A log-odds occupancy grid — the same representation the real coordinator
 * fuses, and the reason this visualisation is a grid rather than a point cloud.
 *
 * Every cell holds a running belief about whether it is occupied, expressed in
 * log-odds so that evidence accumulates by addition. A cell seen empty twenty
 * times and occupied once stays empty; a wall observed from two angles becomes
 * more certain, not merely re-drawn. That distinction is the whole reason
 * occupancy grids exist instead of just remembering where the hits landed.
 */

/** Metres per cell. 5 cm is about what a low-cost 2D LiDAR justifies at these ranges. */
export const CELL_SIZE = 0.05;

const L_FREE = -0.35;
const L_OCCUPIED = 0.9;
const L_MIN = -4;
const L_MAX = 5;

/** Above this a cell is drawn as a wall, below the negative of it as clear floor. */
const CONFIDENT = 1.2;

export class OccupancyGrid {
  readonly size: number;
  readonly halfExtent: number;
  private readonly cells: Float32Array;
  /** Bumped on every write so the renderer knows whether to re-upload. */
  revision = 0;

  constructor(halfExtent: number) {
    this.halfExtent = halfExtent;
    this.size = Math.ceil((halfExtent * 2) / CELL_SIZE);
    this.cells = new Float32Array(this.size * this.size);
  }

  private index(cx: number, cy: number): number {
    return cy * this.size + cx;
  }

  /** World metres to cell coordinates. May fall outside the grid. */
  toCell(x: number, y: number): [number, number] {
    return [
      Math.floor((x + this.halfExtent) / CELL_SIZE),
      Math.floor((y + this.halfExtent) / CELL_SIZE),
    ];
  }

  private bump(cx: number, cy: number, delta: number): void {
    if (cx < 0 || cy < 0 || cx >= this.size || cy >= this.size) return;
    const i = this.index(cx, cy);
    const next = this.cells[i] + delta;
    this.cells[i] = next < L_MIN ? L_MIN : next > L_MAX ? L_MAX : next;
  }

  /**
   * Integrate one beam: everything along the way is evidence of free space,
   * and the endpoint — if the beam actually hit something rather than reaching
   * its maximum range — is evidence of a wall.
   *
   * Bresenham rather than stepping by a fixed distance, so no cell is skipped
   * on a shallow diagonal and none is counted twice.
   */
  integrateBeam(
    originX: number,
    originY: number,
    hitX: number,
    hitY: number,
    didHit: boolean,
  ): void {
    let [cx, cy] = this.toCell(originX, originY);
    const [tx, ty] = this.toCell(hitX, hitY);

    const dx = Math.abs(tx - cx);
    const dy = -Math.abs(ty - cy);
    const sx = cx < tx ? 1 : -1;
    const sy = cy < ty ? 1 : -1;
    let error = dx + dy;

    // Bounded so a pathological ray can never spin here.
    for (let step = 0; step < 4096; step += 1) {
      if (cx === tx && cy === ty) break;
      this.bump(cx, cy, L_FREE);

      const doubled = 2 * error;
      if (doubled >= dy) {
        error += dy;
        cx += sx;
      }
      if (doubled <= dx) {
        error += dx;
        cy += sy;
      }
    }

    if (didHit) this.bump(tx, ty, L_OCCUPIED);

    this.revision += 1;
  }

  clear(): void {
    this.cells.fill(0);
    this.revision += 1;
  }

  /**
   * Paint this grid into an RGBA buffer.
   *
   * Alpha carries confidence, so an unobserved cell is transparent rather than
   * a colour meaning "empty" — the difference between "I looked and there is
   * nothing there" and "I have never looked" is most of what an occupancy grid
   * is for, and flattening it would hide exactly the coverage gaps this
   * visualisation exists to show.
   *
   * `mix` is true when another grid is already in the buffer, in which case
   * this one is added over the top — that is how the unaligned view makes two
   * disagreeing maps visibly disagree.
   */
  paint(
    target: Uint8Array,
    wall: readonly [number, number, number],
    floor: readonly [number, number, number],
    mix = false,
  ): void {
    if (!mix) target.fill(0);

    for (let i = 0; i < this.cells.length; i += 1) {
      const value = this.cells[i];
      if (value > -0.15 && value < 0.15) continue;

      let r: number;
      let g: number;
      let b: number;
      let a: number;

      if (value > 0) {
        const confidence = Math.min(1, value / CONFIDENT);
        [r, g, b] = wall;
        a = 60 + confidence * 195;
      } else {
        const confidence = Math.min(1, -value / CONFIDENT);
        [r, g, b] = floor;
        a = 12 + confidence * 58;
      }

      const o = i * 4;
      if (mix) {
        // Screen blend, so where two maps agree the colour saturates and where
        // they disagree you get two separate ghosts instead of an average.
        target[o] = 255 - ((255 - target[o]) * (255 - r)) / 255;
        target[o + 1] = 255 - ((255 - target[o + 1]) * (255 - g)) / 255;
        target[o + 2] = 255 - ((255 - target[o + 2]) * (255 - b)) / 255;
        target[o + 3] = Math.max(target[o + 3], a);
      } else {
        target[o] = r;
        target[o + 1] = g;
        target[o + 2] = b;
        target[o + 3] = a;
      }
    }
  }

  /** Fraction of cells with a confident opinion either way. Drives the coverage readout. */
  coverage(): number {
    let known = 0;
    for (let i = 0; i < this.cells.length; i += 1) {
      if (this.cells[i] > CONFIDENT || this.cells[i] < -CONFIDENT) known += 1;
    }
    return known / this.cells.length;
  }
}
