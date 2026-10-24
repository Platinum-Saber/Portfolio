import { ramp } from './useScrollProgress';

/**
 * The scroll story's one timeline: progress p (0..1) through the sticky stage
 * mapped to every phase. Live2DStage, the core and the CSS variables all read
 * from here, so moving a phase moves it everywhere.
 *
 *   0.00-0.26  hero: she idles with her capabilities orbiting, then they fly off
 *   0.14-0.42  zoom into her head; the core fades in above it
 *   0.42-0.60  core demo: thinking, then speaking, with a caption
 *   0.56-0.66  she fades out (and her renderer stops)
 *   0.60-0.76  the core moves to the centre and the graph grows out of it
 *   0.74-1.00  the graph is interactive
 */
export const PHASE = {
  hero: [0.1, 0.26],
  zoom: [0.14, 0.42],
  demo: [0.42, 0.6],
  herOut: [0.56, 0.66],
  graph: [0.6, 0.76],
  interactive: 0.74,
} as const;

export type Phases = {
  hero: number;
  zoom: number;
  demo: number; // 0..1 through the demo, linear
  her: number; // her opacity
  graph: number;
};

export function phases(p: number): Phases {
  const [d0, d1] = PHASE.demo;
  return {
    hero: 1 - ramp(p, ...PHASE.hero),
    zoom: ramp(p, ...PHASE.zoom),
    demo: Math.min(1, Math.max(0, (p - d0) / (d1 - d0))),
    her: 1 - ramp(p, ...PHASE.herOut),
    graph: ramp(p, ...PHASE.graph),
  };
}
