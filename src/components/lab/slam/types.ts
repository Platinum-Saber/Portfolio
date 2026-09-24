/** Shared between the canvas and the chrome around it. */

export type ViewMode = 'alpha' | 'bravo' | 'unaligned' | 'fused';

export type DriveInput = { forward: number; turn: number };

export type Readouts = {
  elapsed: number;
  alphaCoverage: number;
  bravoCoverage: number;
  fusedCoverage: number;
  /** Metres between where the scout is and where it believes it is. */
  alphaError: number;
  bravoError: number;
  /** Degrees of heading error - the component that actually warps a map. */
  alphaHeading: number;
  bravoHeading: number;
};

export const VIEWS: ReadonlyArray<{
  id: ViewMode;
  label: string;
  blurb: string;
}> = [
  {
    id: 'alpha',
    label: 'Scout α only',
    blurb:
      'What one robot knows on its own. Internally consistent, and progressively the wrong shape.',
  },
  {
    id: 'bravo',
    label: 'Scout β only',
    blurb:
      'The other half of the arena, from a robot whose odometry is noticeably worse.',
  },
  {
    id: 'unaligned',
    label: 'Both, unaligned',
    blurb:
      'The two maps laid on top of each other with no correction. Neither is wrong about what it saw - they disagree about where they were standing.',
  },
  {
    id: 'fused',
    label: 'Fused',
    blurb:
      'One global map, after the transform between the two frames has been solved.',
  },
];
