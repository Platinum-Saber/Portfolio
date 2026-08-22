/**
 * A Sobel edge detector that runs entirely on the GPU as a fragment shader.
 *
 * Deliberately plain WebGL2 rather than three.js: this is one full-screen
 * triangle pair and one shader, so pulling in a scene graph would cost ~930 KB
 * to save about forty lines. /lab already pays for three.js; this route does
 * not have to.
 *
 * The algorithm is the same 3x3 convolution as the Basys 3 Verilog build —
 * see /projects/fpga-sobel-edge-detection. There, the constraint was that
 * pixels arrive one per clock and you must buffer two rows to have a
 * neighbourhood at all. Here every output pixel gathers its own neighbourhood
 * independently and they all run at once, which is why the same maths costs
 * nothing at 60 fps.
 */

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSource;
uniform vec2  uTexel;   // 1 / source resolution, in UV units
uniform vec3  uEdge;    // colour edges are drawn in
uniform vec3  uBg;      // colour flat regions fall back to
uniform float uMirror;  // 1.0 for the front camera, so it reads as a mirror
uniform float uSplit;   // UVs left of this show the untouched source

in vec2 vUv;
out vec4 fragColor;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float lumaAt(vec2 uv) {
  return dot(texture(uSource, uv).rgb, LUMA);
}

void main() {
  vec2 uv = vec2(mix(vUv.x, 1.0 - vUv.x, uMirror), vUv.y);

  if (vUv.x < uSplit) {
    fragColor = vec4(texture(uSource, uv).rgb, 1.0);
    return;
  }

  vec2 t = uTexel;

  float tl = lumaAt(uv + vec2(-t.x,  t.y));
  float tc = lumaAt(uv + vec2( 0.0,  t.y));
  float tr = lumaAt(uv + vec2( t.x,  t.y));
  float ml = lumaAt(uv + vec2(-t.x,  0.0));
  float mr = lumaAt(uv + vec2( t.x,  0.0));
  float bl = lumaAt(uv + vec2(-t.x, -t.y));
  float bc = lumaAt(uv + vec2( 0.0, -t.y));
  float br = lumaAt(uv + vec2( t.x, -t.y));

  // Sobel kernels: gx responds to vertical edges, gy to horizontal ones.
  float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);

  float mag = clamp(sqrt(gx * gx + gy * gy), 0.0, 1.0);

  // A gentle curve rather than a hard threshold — a binary cut looks crisp on
  // a test chart and turns to confetti on a noisy phone camera.
  mag = smoothstep(0.06, 0.55, mag);

  fragColor = vec4(mix(uBg, uEdge, mag), 1.0);
}`;

export type RenderOptions = {
  /** Mirror horizontally — correct for a user-facing camera, wrong otherwise. */
  mirror: boolean;
  /** Fraction of the width showing the untouched source, 0 to 1. */
  split: number;
  /** Edge colour as [r, g, b], each 0-1. */
  edge: [number, number, number];
  /** Background colour as [r, g, b], each 0-1. */
  background: [number, number, number];
};

export function isWebGL2Supported(): boolean {
  try {
    return Boolean(
      window.WebGL2RenderingContext &&
      document.createElement('canvas').getContext('webgl2'),
    );
  } catch {
    return false;
  }
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader failed to compile: ${log ?? 'unknown error'}`);
  }
  return shader;
}

export class SobelRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private vao: WebGLVertexArrayObject;
  private buffer: WebGLBuffer;
  private uniforms: Record<string, WebGLUniformLocation | null>;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;

    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!program) throw new Error('Could not create program');
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    // Shaders are linked into the program; the objects themselves are dead weight.
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      throw new Error(`Program failed to link: ${log ?? 'unknown error'}`);
    }
    this.program = program;

    // Two triangles covering clip space. No matrices, no camera, no depth.
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) throw new Error('Could not allocate geometry');
    this.vao = vao;
    this.buffer = buffer;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const texture = gl.createTexture();
    if (!texture) throw new Error('Could not allocate texture');
    this.texture = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // CLAMP_TO_EDGE matters: at the frame border the kernel samples outside the
    // image, and wrapping would draw a bright false edge all the way round.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    this.uniforms = {
      uSource: gl.getUniformLocation(program, 'uSource'),
      uTexel: gl.getUniformLocation(program, 'uTexel'),
      uEdge: gl.getUniformLocation(program, 'uEdge'),
      uBg: gl.getUniformLocation(program, 'uBg'),
      uMirror: gl.getUniformLocation(program, 'uMirror'),
      uSplit: gl.getUniformLocation(program, 'uSplit'),
    };
  }

  /**
   * Upload one frame and draw it. `width`/`height` are the source's intrinsic
   * pixel dimensions, which the kernel needs to step exactly one texel.
   */
  render(
    source: TexImageSource,
    width: number,
    height: number,
    options: RenderOptions,
  ): void {
    if (this.disposed || width === 0 || height === 0) return;
    const gl = this.gl;

    // Match the drawing buffer to the source so one output pixel is one input
    // pixel — resampling before a gradient operator softens exactly what we
    // are trying to measure. Capped so a 4K webcam can't melt a phone.
    const scale = Math.min(1, 1280 / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    gl.viewport(0, 0, targetW, targetH);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    gl.uniform1i(this.uniforms.uSource, 0);
    gl.uniform2f(this.uniforms.uTexel, 1 / width, 1 / height);
    gl.uniform3fv(this.uniforms.uEdge, options.edge);
    gl.uniform3fv(this.uniforms.uBg, options.background);
    gl.uniform1f(this.uniforms.uMirror, options.mirror ? 1 : 0);
    gl.uniform1f(this.uniforms.uSplit, options.split);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteBuffer(this.buffer);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
    // Without this the context lingers until GC, and browsers cap how many a
    // page may hold — leaking one per visit eventually kills /lab too.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
