'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { SobelRenderer, isWebGL2Supported } from '@/lib/sobel/renderer';
import { SyntheticScene } from '@/lib/sobel/syntheticScene';

/* The canvas is always dark in both themes, exactly as on /lab, so these are
   fixed rather than read from the theme tokens. */
const EDGE: [number, number, number] = [0.24, 0.86, 0.63];
const BACKGROUND: [number, number, number] = [0.043, 0.055, 0.067];

type Status = 'idle' | 'requesting' | 'running' | 'error';
type Source = 'camera' | 'synthetic';

/** One run of the demo. The id remounts the canvas — see the effect below. */
type Session = { id: number; source: Source };

type Support = 'checking' | 'ok' | 'unsupported';

type Frame = { image: TexImageSource; width: number; height: number };

let cachedSupport: Support | null = null;

function readSupport(): Support {
  if (cachedSupport) return cachedSupport;
  cachedSupport = isWebGL2Supported() ? 'ok' : 'unsupported';
  return cachedSupport;
}

const NEVER_CHANGES = () => () => {};
const SERVER_SNAPSHOT = (): Support => 'checking';

/** Turns whatever getUserMedia threw into something a visitor can act on. */
function describeCameraFailure(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access was declined. The test target below runs the identical shader — nothing is missing except your face.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found on this device. The test target runs the identical shader.';
  }
  if (name === 'NotReadableError') {
    return 'The camera is in use by another application. Close it and try again, or run the test target instead.';
  }
  return 'The camera could not be started. The test target runs the identical shader.';
}

export function EdgeDetector() {
  const support = useSyncExternalStore(
    NEVER_CHANGES,
    readSupport,
    SERVER_SNAPSHOT,
  );

  const [status, setStatus] = useState<Status>('idle');
  const [session, setSession] = useState<Session | null>(null);
  const [pending, setPending] = useState<Source>('camera');
  const [message, setMessage] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [fps, setFps] = useState<number | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readFrameRef = useRef<(() => Frame | null) | null>(null);
  const runCounter = useRef(0);

  // Read inside the render loop so toggling them never restarts it.
  const showOriginalRef = useRef(showOriginal);
  const pausedRef = useRef(false);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    showOriginalRef.current = showOriginal;
  }, [showOriginal]);

  /** Releases the camera. The GL side is torn down by the session effect. */
  const releaseMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    readFrameRef.current = null;
  }, []);

  const stop = useCallback(() => {
    releaseMedia();
    setSession(null);
    setFps(null);
    setStatus('idle');
  }, [releaseMedia]);

  // Whatever else happens, never leave a camera light on.
  useEffect(() => releaseMedia, [releaseMedia]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      reducedMotionRef.current = query.matches;
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // Same policy as the /lab canvas: no GPU work for a canvas nobody is looking
  // at. The camera stream itself keeps running, so resuming is instant.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        pausedRef.current = !entry.isIntersecting;
      },
      { threshold: 0.05 },
    );
    observer.observe(el);

    const onVisibilityChange = () => {
      pausedRef.current = document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  /**
   * The render loop lives in an effect rather than in the click handler because
   * disposing a WebGL context permanently poisons the canvas element it came
   * from — a second run on the same <canvas> fails to compile the shader. The
   * session id is the canvas key, so every run gets a genuinely new element and
   * React guarantees it is committed before this effect reads the ref.
   */
  useEffect(() => {
    if (!session) return;
    const canvas = canvasRef.current;
    const readFrame = readFrameRef.current;
    if (!canvas || !readFrame) return;

    // Built on the first frame rather than here, so that both outcomes —
    // running, or a driver that refused the shader — are reported from a
    // callback instead of synchronously inside the effect body.
    let renderer: SobelRenderer | null = null;
    const mirror = session.source === 'camera';
    let frame = 0;
    let last = performance.now();
    let smoothed = 0;
    let sinceReport = 0;

    const tick = (now: number) => {
      if (!renderer) {
        try {
          renderer = new SobelRenderer(canvas);
        } catch (error) {
          releaseMedia();
          setSession(null);
          setStatus('error');
          setMessage(
            error instanceof Error
              ? `The GPU pipeline failed to start: ${error.message}`
              : 'The GPU pipeline failed to start.',
          );
          return;
        }
        setStatus('running');
      }

      frame = requestAnimationFrame(tick);

      const delta = now - last;
      last = now;
      if (pausedRef.current) return;

      const next = readFrame();
      if (!next) return;

      renderer.render(next.image, next.width, next.height, {
        mirror,
        split: showOriginalRef.current ? 0.5 : 0,
        edge: EDGE,
        background: BACKGROUND,
      });

      if (delta > 0 && delta < 250) {
        smoothed =
          smoothed === 0 ? 1000 / delta : smoothed * 0.9 + (1000 / delta) * 0.1;
      }
      sinceReport += delta;
      if (sinceReport > 500) {
        sinceReport = 0;
        setFps(Math.round(smoothed));
      }
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      renderer?.dispose();
    };
  }, [session, releaseMedia]);

  const runSynthetic = useCallback(() => {
    releaseMedia();
    setPending('synthetic');
    setMessage(null);
    setStatus('requesting');

    const scene = new SyntheticScene();
    const started = performance.now();
    readFrameRef.current = () => {
      const time = reducedMotionRef.current
        ? 0
        : (performance.now() - started) / 1000;
      scene.draw(time);
      return { image: scene.canvas, width: scene.width, height: scene.height };
    };

    runCounter.current += 1;
    setSession({ id: runCounter.current, source: 'synthetic' });
  }, [releaseMedia]);

  const runCamera = useCallback(async () => {
    releaseMedia();
    setSession(null);
    setPending('camera');
    setMessage(null);
    setStatus('requesting');

    let stream: MediaStream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException('unsupported', 'NotFoundError');
      }
      stream = await navigator.mediaDevices.getUserMedia({
        // 720p is plenty: the kernel is a 3x3 neighbourhood, and asking for
        // more pixels costs upload bandwidth without showing more structure.
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (error) {
      setStatus('error');
      setMessage(describeCameraFailure(error));
      return;
    }

    streamRef.current = stream;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    try {
      await video.play();
    } catch {
      releaseMedia();
      setStatus('error');
      setMessage('The camera stream could not be played back in this browser.');
      return;
    }

    readFrameRef.current = () => {
      if (video.readyState < 2 || video.videoWidth === 0) return null;
      return {
        image: video,
        width: video.videoWidth,
        height: video.videoHeight,
      };
    };

    runCounter.current += 1;
    setSession({ id: runCounter.current, source: 'camera' });
  }, [releaseMedia]);

  if (support === 'unsupported') {
    return (
      <div
        className="glass p-6 text-sm"
        style={{
          color: 'var(--fg-muted)',
        }}
      >
        <p className="font-medium" style={{ color: 'var(--fg)' }}>
          This demo needs WebGL2, which this browser has turned off or does not
          support.
        </p>
        <p className="mt-2">
          The explanation below stands on its own — and the kernel itself is
          printed there, so there is nothing hidden inside the shader.
        </p>
      </div>
    );
  }

  const running = status === 'running' && session !== null;
  const source = session?.source ?? pending;
  const ready = support === 'ok';

  return (
    <div>
      <div
        ref={wrapperRef}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border"
        style={{ borderColor: 'var(--border)', backgroundColor: '#0b0e11' }}
      >
        <canvas
          key={session?.id ?? 'idle'}
          ref={canvasRef}
          className="h-full w-full object-contain"
          aria-label="Live Sobel edge detection output"
        />

        {!running && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            {status === 'requesting' ? (
              <p className="font-mono text-sm" style={{ color: '#7d8794' }}>
                {pending === 'camera'
                  ? 'Waiting for camera permission…'
                  : 'Starting…'}
              </p>
            ) : (
              <div className="max-w-sm">
                <button
                  type="button"
                  onClick={() => void runCamera()}
                  disabled={!ready}
                  className="rounded-md px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#3ddba0', color: '#08120e' }}
                >
                  Run demo on my camera
                </button>
                <p className="mt-3 text-xs" style={{ color: '#7d8794' }}>
                  Frames are processed on your GPU and never leave the page.
                  Nothing is recorded, stored or uploaded.
                </p>
                <button
                  type="button"
                  onClick={runSynthetic}
                  disabled={!ready}
                  className="mt-4 font-mono text-xs underline underline-offset-4 disabled:opacity-50"
                  style={{ color: '#3ddba0' }}
                >
                  or run it on a synthetic test target
                </button>
              </div>
            )}
          </div>
        )}

        {running && showOriginal && (
          <>
            <p
              className="pointer-events-none absolute top-3 left-3 font-mono text-[11px]"
              style={{ color: '#7d8794' }}
            >
              source
            </p>
            <p
              className="pointer-events-none absolute top-3 right-3 font-mono text-[11px]"
              style={{ color: '#3ddba0' }}
            >
              |∇I|
            </p>
          </>
        )}

        {running && fps !== null && (
          <p
            className="pointer-events-none absolute right-3 bottom-3 font-mono text-[11px]"
            style={{ color: '#7d8794' }}
          >
            {fps} fps · {source === 'camera' ? 'camera' : 'test target'}
          </p>
        )}
      </div>

      {status === 'error' && message && (
        <div
          className="glass mt-4 p-4 text-sm"
          style={{ color: 'var(--fg-muted)' }}
          role="status"
        >
          <p>{message}</p>
          <button
            type="button"
            onClick={runSynthetic}
            className="mt-3 font-mono text-xs hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            → run the test target instead
          </button>
        </div>
      )}

      {running && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowOriginal((prev) => !prev)}
            className="glass glass-btn glass-press px-3 py-1.5 font-mono text-[11px]"
            style={{ color: 'var(--fg-muted)' }}
            aria-pressed={showOriginal}
          >
            {showOriginal ? 'edges only' : 'compare with source'}
          </button>
          {source === 'camera' ? (
            <button
              type="button"
              onClick={runSynthetic}
              className="glass glass-btn glass-press px-3 py-1.5 font-mono text-[11px]"
              style={{ color: 'var(--fg-muted)' }}
            >
              switch to test target
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void runCamera()}
              className="glass glass-btn glass-press px-3 py-1.5 font-mono text-[11px]"
              style={{ color: 'var(--fg-muted)' }}
            >
              switch to camera
            </button>
          )}
          <button
            type="button"
            onClick={stop}
            className="glass glass-btn glass-press px-3 py-1.5 font-mono text-[11px]"
            style={{ color: 'var(--fg-muted)' }}
          >
            stop
          </button>
        </div>
      )}
    </div>
  );
}
