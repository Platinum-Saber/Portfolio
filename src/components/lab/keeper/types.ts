/** Shared between the canvas and the chrome around it. */
import type { Estimator, ShotOutcome } from '@/lib/keeper/sim';

export type Readouts = {
  phase: 'ready' | 'flight' | 'settled';
  sightings: number;
  /** Null until the second gate has been crossed. */
  ekfError: number | null;
  lineError: number | null;
  outcome: ShotOutcome | null;
  shots: number;
  saves: number;
  /** Seconds between the prediction and the ball reaching the goal. */
  reactionTime: number | null;
};

export type Controls = {
  aimX: number;
  aimY: number;
  speed: number;
  noise: number;
  farGate: number;
  nearGate: number;
  estimator: Estimator;
};

export const ESTIMATORS: ReadonlyArray<{
  id: Estimator;
  label: string;
  blurb: string;
}> = [
  {
    id: 'ekf',
    label: 'EKF (gravity)',
    blurb:
      'The filter the robot runs: six states, gravity in the motion model, marched forward to the goal plane. It predicts an arc, so it aims where the ball is falling to.',
  },
  {
    id: 'line',
    label: 'Straight line',
    blurb:
      'The obvious thing - draw a line through the two sightings and follow it. It ignores gravity, so it consistently guesses high, and the faster the shot the less that costs.',
  },
];
