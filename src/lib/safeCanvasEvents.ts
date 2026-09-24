import { events as createPointerEvents } from '@react-three/fiber';
import type { EventManager } from '@react-three/fiber';

/**
 * r3f's default pointer events, with `connect` refusing a null target.
 *
 * `<Canvas>` configures its root asynchronously and only connects events to
 * its container once that resolves. If the canvas unmounts while a configure
 * is still pending - which is exactly what leaving a deep-linked /explore does,
 * because `router.back()` tears the route down in the same beat as the
 * re-render that exiting fullscreen caused - the container ref is already
 * null by the time `connect(divRef.current)` runs, and r3f throws
 * "Cannot read properties of null (reading 'addEventListener')" from its
 * Provider. A canvas that is gone has nothing to listen to, so skipping the
 * connect is the correct behaviour, not a workaround.
 *
 * Pass as `events={safeCanvasEvents}` on every <Canvas>.
 */
export function safeCanvasEvents(
  store: Parameters<typeof createPointerEvents>[0],
): EventManager<HTMLElement> {
  const manager = createPointerEvents(store);
  const connect = manager.connect;
  return {
    ...manager,
    connect: (target: HTMLElement) => {
      if (target) connect?.(target);
    },
  };
}
