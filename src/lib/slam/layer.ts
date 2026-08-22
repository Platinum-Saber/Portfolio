import { DataTexture, LinearFilter, RGBAFormat } from 'three';
import type { OccupancyGrid } from './grid';

/**
 * One occupancy grid, as something the GPU can draw.
 *
 * This exists as a class rather than a bag of values because the render loop
 * has to repaint the pixels and flag the texture for re-upload, and React's
 * compiler quite reasonably refuses to let a component reach into an object a
 * hook handed it and start setting properties. Wrapping the mutation in a
 * method keeps the ownership honest: the layer maintains its own buffer, and
 * callers ask it to refresh rather than poking at its internals.
 */
export class GridLayer {
  readonly texture: DataTexture;
  private readonly data: Uint8Array;
  private lastRevision = -1;

  constructor(size: number) {
    this.data = new Uint8Array(size * size * 4);
    this.texture = new DataTexture(this.data, size, size, RGBAFormat);
    // Linear filtering, so cells blend rather than reading as a checkerboard
    // of hard squares when the camera comes close.
    this.texture.magFilter = LinearFilter;
    this.texture.minFilter = LinearFilter;
    this.texture.needsUpdate = true;
  }

  /**
   * Repaint from `grid`, unless nothing has changed since last time.
   *
   * @param overlay paint on top of what is already in the buffer instead of
   *   clearing it — used by the unaligned view to put two maps in one texture.
   */
  refresh(
    grid: OccupancyGrid,
    wall: readonly [number, number, number],
    floor: readonly [number, number, number],
    overlay = false,
  ): void {
    // A paused simulation stops changing its grids, so this skips the upload
    // entirely rather than pushing an identical quarter-megabyte every frame.
    if (!overlay && grid.revision === this.lastRevision) return;
    this.lastRevision = grid.revision;

    grid.paint(this.data, wall, floor, overlay);
    this.texture.needsUpdate = true;
  }

  /** Forces the next refresh to repaint even if the grid looks unchanged. */
  invalidate(): void {
    this.lastRevision = -1;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
