import type { Metadata } from 'next';
import Link from 'next/link';
import { KeeperExplorer } from '@/components/lab/keeper/KeeperExplorer';

export const metadata: Metadata = {
  title: 'Lab — Goalkeeper Interception',
  description:
    'An interactive simulation of the RoboKeeper problem: a depth camera sees a shot twice, an Extended Kalman Filter predicts where it will cross the goal, and a servo has milliseconds to get there.',
};

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-4 leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
    {children}
  </p>
);

const H = ({ children }: { children: React.ReactNode }) => (
  <h2
    className="mt-12 text-sm font-semibold tracking-widest uppercase"
    style={{ color: 'var(--fg-muted)' }}
  >
    {children}
  </h2>
);

export default function KeeperLabPage() {
  return (
    <div>
      <p className="font-mono text-sm" style={{ color: 'var(--accent)' }}>
        Lab
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Goalkeeper interception
      </h1>
      <p
        className="mt-4 max-w-2xl leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        The problem behind{' '}
        <Link
          href="/projects/robokeeper-goalkeeper-robot"
          className="underline underline-offset-2"
          style={{ color: 'var(--accent)' }}
        >
          RoboKeeper
        </Link>
        , with the lid off. Take a shot: the camera sees the ball exactly twice,
        at the two gates, and each sighting is a little bit wrong. From that
        pair the keeper has to decide where the ball will cross the goal — and
        get a servo there before it does.
      </p>

      <div className="mt-9">
        <KeeperExplorer />
      </div>

      <section className="max-w-2xl">
        <H>Why a straight line loses</H>
        <P>
          Two points define a line, and a line is the obvious thing to draw
          through them. But a football is falling the whole way, so the path
          from the near gate to the goal is a curve, and the line runs off the
          top of it. Switch the keeper to <strong>straight line</strong> and
          take the same shot twice: the amber prediction lands above the green
          one, every time, and the gap is the drop the ball made in the last
          couple of metres.
        </P>
        <P>
          That gap is not a constant. Wind the shot speed down and the ball
          spends longer in the air over the same distance, so it falls further
          and the line misses by more. A hard, flat shot is the one case where
          ignoring gravity nearly works — which is exactly the case where the
          servo has the least time to move.
        </P>

        <H>Why the gates matter twice</H>
        <P>
          The <strong>far gate</strong> and <strong>near gate</strong> sliders
          change two things at once, in opposite directions. Sliding them
          together shortens the baseline the velocity is measured over, and
          because each sighting carries the same error, halving the gap roughly
          doubles the error in the estimated speed — the prediction gets worse.
          Sliding the near gate toward the goal makes the reaction time readout
          shrink, and below roughly a tenth of a second the servo simply cannot
          swing far enough, however right the maths was. The verdict line says
          which of the two failed.
        </P>

        <H>What the filter is actually doing</H>
        <P>
          The Extended Kalman Filter carries six numbers — position and velocity
          in three axes — and a measure of how much it trusts each one. It
          advances that state with a model of how a ball moves, gravity
          included, then folds in each measurement according to whether the
          model or the camera is more believable at that moment. Turn the noise
          slider up and watch the green error grow: with two sightings the
          filter has nothing to average over, so noise goes almost straight
          through to the prediction.
        </P>
        <P>
          That is the honest limit of the two-gate design. A filter earns its
          keep when it has a stream of measurements to smooth; here it earns its
          keep by knowing that balls fall. The real system chose two gates
          because detecting reliably is easier than tracking continuously — and
          the filter is what makes two points enough.
        </P>

        <P>
          This is a simple simulation of what happens, not a digital twin of the
          robot: the ball flies on plain ballistics, and the camera is a pair of
          planes rather than a detector.
        </P>
      </section>
    </div>
  );
}
