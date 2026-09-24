/**
 * The fallback source, for anyone who declines the camera or has none.
 *
 * It is drawn rather than downloaded, for the same reason the airframe on /lab
 * is procedural: a bundled sample clip would be the single heaviest asset on
 * the site, and this costs about two kilobytes of JavaScript. It also moves,
 * which a still image would not - the point of the demo is that the
 * convolution runs per frame in real time, and a frozen picture proves nothing.
 *
 * The content is a deliberate test target rather than a photo: a contrast
 * staircase, a resolution wedge whose lines converge until the kernel can no
 * longer separate them, soft gradients that should produce *no* edge, and hard
 * shapes that should produce a clean one.
 */

const WIDTH = 720;
const HEIGHT = 540;

export class SyntheticScene {
  readonly canvas: HTMLCanvasElement;
  readonly width = WIDTH;
  readonly height = HEIGHT;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas is not available');
    this.canvas = canvas;
    this.ctx = ctx;
  }

  /** @param time seconds since the demo started. */
  draw(time: number): void {
    const ctx = this.ctx;

    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // A smooth ramp. Sobel measures the *rate* of change, so a slow gradient
    // is nearly invisible to it however bright it gets - worth being able to
    // point at.
    const ramp = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    ramp.addColorStop(0, '#101418');
    ramp.addColorStop(1, '#39424d');
    ctx.fillStyle = ramp;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Contrast staircase: eight steps, so you can see roughly where the
    // smoothstep in the shader stops calling a step an edge.
    for (let i = 0; i < 8; i += 1) {
      const level = Math.round((i / 7) * 235) + 10;
      ctx.fillStyle = `rgb(${level},${level},${level})`;
      ctx.fillRect(40 + i * 42, 40, 42, 70);
    }

    // Resolution wedge: parallel lines that converge left to right until
    // neighbouring edges fall inside one 3x3 window and cancel.
    ctx.strokeStyle = '#e8eaed';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 26; i += 1) {
      const x = 40 + i * i * 0.95;
      if (x > 380) break;
      ctx.beginPath();
      ctx.moveTo(x, 150);
      ctx.lineTo(x, 250);
      ctx.stroke();
    }

    // A rotating square and an orbiting disc - moving geometry with hard
    // borders, which is what makes the output legible as real-time.
    ctx.save();
    ctx.translate(540, 190);
    ctx.rotate(time * 0.6);
    ctx.fillStyle = '#c8ccd2';
    ctx.fillRect(-58, -58, 116, 116);
    ctx.fillStyle = '#101418';
    ctx.fillRect(-26, -26, 52, 52);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(
      360 + Math.cos(time * 0.8) * 200,
      400 + Math.sin(time * 0.8) * 80,
      46,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = '#8f98a3';
    ctx.fill();

    // Soft-edged blob: blurred boundaries give a weak, wide gradient response
    // rather than a thin bright line. The contrast with the square is the
    // whole lesson.
    const blob = ctx.createRadialGradient(150, 400, 4, 150, 400, 90);
    blob.addColorStop(0, 'rgba(232,234,237,0.95)');
    blob.addColorStop(1, 'rgba(232,234,237,0)');
    ctx.fillStyle = blob;
    ctx.beginPath();
    ctx.arc(150, 400, 90, 0, Math.PI * 2);
    ctx.fill();

    // Text is dense high-frequency detail and a good stress case.
    ctx.fillStyle = '#e8eaed';
    ctx.font =
      '600 26px ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace';
    ctx.fillText('SOBEL 3x3', 470, 430);
    ctx.font =
      '400 15px ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace';
    ctx.fillText('synthetic test target', 470, 458);

    ctx.strokeStyle = '#5f6570';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2);
  }
}
