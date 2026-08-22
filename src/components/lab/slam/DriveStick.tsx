'use client';

import { useRef, useState } from 'react';
import type { DriveInput } from './types';

/**
 * A thumb stick for touch, because "WASD to drive" is not an interaction on a
 * phone — it is a notice that the phone was an afterthought.
 *
 * Pointer events rather than touch events, so the same code serves a finger, a
 * mouse and a stylus. Pointer capture means a drag that wanders outside the pad
 * keeps steering instead of silently dropping the robot mid-turn.
 */
export function DriveStick({
  onChange,
}: {
  onChange: (input: DriveInput) => void;
}) {
  const pad = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);

  const update = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = pad.current;
    if (!element) return;

    const bounds = element.getBoundingClientRect();
    const radius = bounds.width / 2;
    let dx = event.clientX - (bounds.left + radius);
    let dy = event.clientY - (bounds.top + radius);

    // Clamp to the pad so the knob cannot be flung into the corner and the
    // command cannot exceed full deflection.
    const distance = Math.hypot(dx, dy);
    if (distance > radius) {
      dx = (dx / distance) * radius;
      dy = (dy / distance) * radius;
    }

    setKnob({ x: dx, y: dy });
    // Screen down is positive, forward is negative — hence the sign. Turn is
    // inverted too: pushing right should yaw the robot right, and the
    // simulation's positive turn is anticlockwise.
    onChange({ forward: -dy / radius, turn: -dx / radius });
  };

  const release = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setKnob(null);
    onChange({ forward: 0, turn: 0 });
  };

  return (
    <div
      ref={pad}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 0 && event.pointerType === 'mouse') return;
        if (knob === null && event.pointerType !== 'mouse') return;
        update(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      // touch-none stops the browser treating a drag here as a page scroll,
      // which on a phone would otherwise make the stick almost unusable.
      className="absolute right-4 bottom-4 h-28 w-28 touch-none rounded-full border select-none"
      style={{
        borderColor: 'rgba(125,135,148,0.4)',
        backgroundColor: 'rgba(14,17,20,0.55)',
      }}
      role="application"
      aria-label="Drive stick. Keyboard alternative: W A S D or the arrow keys."
    >
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 h-11 w-11 rounded-full border"
        style={{
          borderColor: '#3ddba0',
          backgroundColor: 'rgba(61,219,160,0.18)',
          transform: `translate(calc(-50% + ${knob?.x ?? 0}px), calc(-50% + ${knob?.y ?? 0}px))`,
        }}
      />
    </div>
  );
}
