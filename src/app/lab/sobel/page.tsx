import type { Metadata } from 'next';
import Link from 'next/link';
import { EdgeDetector } from '@/components/lab/sobel/EdgeDetector';

export const metadata: Metadata = {
  title: 'Lab — Sobel Edge Detection in a Shader',
  description:
    'Real-time Sobel edge detection running as a WebGL2 fragment shader on live camera input, entirely in the browser. The same 3×3 convolution I built in Verilog on a Basys 3 FPGA, implemented a second way.',
};

const KERNEL_X = ['-1  0  +1', '-2  0  +2', '-1  0  +1'];
const KERNEL_Y = ['+1 +2 +1', ' 0  0  0', '-1 -2 -1'];

export default function SobelPage() {
  return (
    <div>
      <p className="font-mono text-sm" style={{ color: 'var(--accent)' }}>
        Lab
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Sobel edge detection, in a shader
      </h1>
      <p
        className="mt-4 max-w-2xl leading-relaxed"
        style={{ color: 'var(--fg-muted)' }}
      >
        The same 3×3 convolution I built in Verilog for a Basys 3 FPGA, running
        here as a WebGL2 fragment shader on your own camera. Nothing is uploaded
        — the frames go from the camera to your GPU and are discarded. There is
        no server involved in this page at all.
      </p>

      <div className="mt-9">
        <EdgeDetector />
      </div>

      <section className="mt-16 max-w-2xl">
        <h2
          className="text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          What it is doing
        </h2>

        <p
          className="mt-5 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          An edge is a place where brightness changes quickly. Sobel estimates
          that rate of change by sliding two 3×3 kernels over the image — one
          measuring the horizontal gradient, one the vertical — and combining
          them into a magnitude, <span className="font-mono">√(Gx² + Gy²)</span>
          . Bright output means a steep change; flat regions, however bright,
          come out dark. The middle row and column carry double weight, which is
          a cheap way of smoothing along the edge while differentiating across
          it, so the operator is far less twitchy about sensor noise than a bare
          difference would be.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            { label: 'Gx — vertical edges', rows: KERNEL_X },
            { label: 'Gy — horizontal edges', rows: KERNEL_Y },
          ].map((kernel) => (
            <div
              key={kernel.label}
              className="glass p-4"
            >
              <p
                className="font-mono text-[11px] tracking-wide uppercase"
                style={{ color: 'var(--fg-muted)' }}
              >
                {kernel.label}
              </p>
              <pre className="mt-3 font-mono text-sm leading-relaxed">
                {kernel.rows.join('\n')}
              </pre>
            </div>
          ))}
        </div>

        <p
          className="mt-6 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          The shader runs once per output pixel, gathering that pixel&rsquo;s
          eight neighbours and producing its gradient magnitude. Every pixel is
          independent of every other, which is exactly the shape of problem a
          GPU exists for — a 1280×720 frame is nine hundred thousand of these,
          and they all finish inside a frame budget without effort. Instead of a
          hard threshold the magnitude passes through a{' '}
          <span className="font-mono">smoothstep</span>: a binary cut looks
          crisp on a test chart and disintegrates into speckle on a noisy phone
          camera.
        </p>

        <h2
          className="mt-12 text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          The same algorithm, two very different machines
        </h2>

        <p
          className="mt-5 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          I built this operator before, in{' '}
          <Link
            href="/projects/fpga-sobel-edge-detection"
            className="underline underline-offset-2"
            style={{ color: 'var(--accent)' }}
          >
            Verilog on an Artix-7
          </Link>
          , and the interesting part is how little the two implementations have
          in common. On the FPGA there is no image — pixels arrive from an
          OV7670 one per clock, and a 3×3 neighbourhood only exists if you have
          already spent block RAM buffering the previous two rows. The whole
          design is that line buffer, plus reconciling three clock domains that
          do not agree. It is sequential, and the constraint is memory and
          timing.
        </p>

        <p
          className="mt-4 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          On a GPU the frame is already sitting in memory and every output pixel
          can read whatever it likes, so the line buffer — the hard part, the
          part the FPGA design was mostly about — simply does not exist. What
          costs nothing on one machine is the entire problem on the other.
          Neither is the &ldquo;real&rdquo; implementation; the algorithm is the
          same fifteen multiply-accumulates either way.
        </p>

        <h2
          className="mt-12 text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          Why it runs in your browser
        </h2>

        <p
          className="mt-5 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          The obvious architecture for a demo like this is a Python service
          behind an API. It would also be worse in every way that matters here:
          a round trip per frame makes real time impossible, an idle server
          costs money every month, and a cold start greets the one recruiter who
          clicks the link with a thirty-second spinner. Running client-side
          costs nothing, scales to any number of visitors, and means your camera
          frames never travel anywhere. It is also the more honest demonstration
          — nothing is hidden behind an endpoint.
        </p>

        <p
          className="mt-4 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          It is written in plain WebGL2 rather than three.js. This page needs
          two triangles and one shader; a scene graph would have added the best
          part of a megabyte to save about forty lines. The{' '}
          <Link
            href="/lab"
            className="underline underline-offset-2"
            style={{ color: 'var(--accent)' }}
          >
            Airframe Explorer
          </Link>{' '}
          pays for three.js because it genuinely needs one — that cost stays on
          that route.
        </p>

        <h2
          className="mt-12 text-sm font-semibold tracking-widest uppercase"
          style={{ color: 'var(--fg-muted)' }}
        >
          The test target
        </h2>

        <p
          className="mt-5 leading-relaxed"
          style={{ color: 'var(--fg-muted)' }}
        >
          If you would rather not turn on a camera, the fallback is a synthetic
          scene drawn in code rather than a bundled video clip — a few kilobytes
          instead of the heaviest asset on the site. It is built to be read
          rather than admired: a contrast staircase showing roughly where the
          operator stops calling a step an edge, a wedge of converging lines
          that blurs into nothing once neighbouring edges fall inside the same
          3×3 window, a smooth gradient that stays almost invisible no matter
          how bright it gets, and hard-edged shapes moving against all of it.
        </p>
      </section>

      <nav
        className="mt-16 flex flex-wrap gap-x-8 gap-y-3 border-t pt-6"
        style={{ borderColor: 'var(--border)' }}
      >
        <Link
          href="/projects/fpga-sobel-edge-detection"
          className="hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          ← The FPGA implementation
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
