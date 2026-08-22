import type { Metadata } from 'next';
import Link from 'next/link';
import { SlamExplorer } from '@/components/lab/slam/SlamExplorer';

export const metadata: Metadata = {
  title: 'Lab — Collaborative SLAM Arena',
  description:
    'An interactive simulation of the ASCILAM problem: two LiDAR scouts map an arena, their odometry drifts apart, and their two maps only agree once the transform between their frames is solved.',
};

export default function AscilamLabPage() {
  return (
    <div>
      <p className="font-mono text-sm" style={{ color: 'var(--accent)' }}>
        Lab
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Collaborative SLAM arena
      </h1>
      <p
        className="mt-4 max-w-2xl leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        Two scouts from{' '}
        <Link
          href="/projects/ascilam-collaborative-slam"
          className="underline underline-offset-2"
          style={{ color: 'var(--accent)' }}
        >
          ASCILAM
        </Link>{' '}
        sweeping an arena with 2D LiDAR. Watch the map build, then switch
        between what each robot believes on its own, what happens when you
        overlay those beliefs without correcting them, and the fused result.
        Take control of a scout and the map grows wherever you drive it.
      </p>

      <div className="mt-9">
        <SlamExplorer />
      </div>

      <section className="mt-16 max-w-2xl">
        <h2
          className="text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          Why the maps disagree
        </h2>

        <p
          className="mt-5 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          Each scout works out where it is by counting wheel rotations. That
          estimate is wrong immediately and gets wronger: a wheel slips, a tyre
          is fractionally larger than its twin, a turn ends half a degree short.
          None of it is recoverable, because there is nothing to check it
          against. The error integrates.
        </p>

        <p
          className="mt-4 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          Heading error is the one that does real damage. A few centimetres of
          position error smears a wall slightly. A few degrees of heading error
          rotates <em>everything the robot records from that moment on</em>, and
          the further away the wall, the further it lands from where it belongs.
          Watch the drift figures under the arena: the position number climbs
          steadily, but the map only starts to look visibly bent once the
          heading number does. Scout β is set to drift about twice as fast as α,
          which is not unrealistic — one tired motor will do it.
        </p>

        <p
          className="mt-4 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          So each scout&rsquo;s own map is <em>self-consistent and wrong</em>.
          It is a faithful record of what the sensor saw, filed under a set of
          poses that were quietly diverging from reality the whole time. Two
          such maps cannot simply be laid on top of each other — that is the{' '}
          <strong>unaligned</strong> view, and the two ghosts of the same
          corridor refusing to line up are the actual problem the project is
          about. Finding the transform that reconciles them is the work.
        </p>

        <h2
          className="mt-12 text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          Try breaking one
        </h2>

        <p
          className="mt-5 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          Take control of a scout, drive it nose-first into a wall, and hold it
          there. The robot stops. Its odometry does not — the wheels are still
          turning, so it goes on believing it is travelling forward, and every
          scan it records for those few seconds gets filed metres from where it
          was actually taken. Watch the drift figure climb and the map tear.
        </p>

        <p
          className="mt-4 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          That is wheel slip, and it is not a quirk of the simulation. It is the
          fastest way to ruin an odometry estimate on real hardware, and it is
          most of the reason the scouts run an EKF over wheel encoders{' '}
          <em>and</em> an IMU rather than trusting the encoders alone: the IMU
          knows the robot did not turn, and disagrees.
        </p>

        <h2
          className="mt-12 text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          What this is honestly not
        </h2>

        <p
          className="mt-5 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          The fused view here is built by filing every scan at its <em>true</em>{' '}
          pose, which the simulation happens to know because it invented it. It
          is a stand-in for a solved alignment, not a scan matcher — I have not
          re-implemented graph SLAM in a browser and would not claim to. On the
          real system that correction is earned: an EKF over wheel odometry and
          IMU on each scout, then <code>multirobot_map_merge</code> on the
          Raspberry Pi coordinator. What this page can show faithfully is the
          shape of the problem and what success looks like.
        </p>

        <p
          className="mt-4 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          Everything else is close to the hardware. The occupancy grid is
          log-odds at 5 cm resolution, so evidence accumulates rather than
          overwriting — a cell seen empty twenty times and occupied once stays
          empty. The LiDAR turns at 5.5 Hz with a 6 m useful range, roughly an
          RPLiDAR A1. Unobserved cells are drawn transparent rather than as
          floor, because &ldquo;I looked and it is clear&rdquo; and &ldquo;I
          have never looked&rdquo; are different claims and conflating them
          would hide the coverage gaps this is meant to expose.
        </p>

        <h2
          className="mt-12 text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          The arena
        </h2>

        <p
          className="mt-5 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          Twelve metres square, split by a spine with one doorway. The layout is
          deliberate: neither scout can see across the divider, so each spends
          most of its run mapping territory the other has never observed. If
          both robots saw the same room, fusing their maps would be a redundancy
          exercise. The interesting version is when the global map contains
          things no single robot ever saw.
        </p>

        <p
          className="mt-4 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          The scouts are procedural geometry for now — a chassis, two drive
          wheels, a castor and a spinning LiDAR puck — sized to the 0.16 m
          collision radius the simulation enforces. When the real CAD is
          exported there is a documented swap-in point in{' '}
          <code>ScoutModel.tsx</code>; that is also the moment the parked Phase
          3 asset pipeline earns its place.
        </p>
      </section>

      <nav
        className="mt-16 flex flex-wrap gap-x-8 gap-y-3 border-t pt-6"
        style={{ borderColor: 'var(--border)' }}
      >
        <Link
          href="/projects/ascilam-collaborative-slam"
          className="hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          ← ASCILAM write-up
        </Link>
        <Link
          href="/lab"
          className="hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Airframe Explorer →
        </Link>
      </nav>
    </div>
  );
}
