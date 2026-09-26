'use client';

import { useRef, useState } from 'react';

type Axes = { x: number; y: number };

/**
 * Twin thumb sticks, laid out Mode 2 - the way an actual transmitter is
 * arranged. Left stick is throttle and yaw, right stick is pitch and roll.
 * Anyone who has flown a quad will pick it up without reading anything, and
 * anyone who has not is no worse off than with an invented layout.
 */
function Stick({
  label,
  hint,
  onChange,
}: {
  label: string;
  hint: string;
  onChange: (axes: Axes) => void;
}) {
  const pad = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const [knob, setKnob] = useState<Axes>({ x: 0, y: 0 });

  const update = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = pad.current;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const radius = bounds.width / 2;
    let dx = event.clientX - (bounds.left + radius);
    let dy = event.clientY - (bounds.top + radius);
    const distance = Math.hypot(dx, dy);
    if (distance > radius) {
      dx = (dx / distance) * radius;
      dy = (dy / distance) * radius;
    }
    setKnob({ x: dx, y: dy });
    // Screen-down is positive; every axis here means the opposite.
    onChange({ x: -dx / radius, y: -dy / radius });
  };

  const release = (event: React.PointerEvent<HTMLDivElement>) => {
    active.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    // Self-centring, like a real gimbal - except throttle, which on a real
    // transmitter is ratcheted. Self-centring is kinder here: releasing should
    // stop the drone, not leave it climbing away while you read.
    setKnob({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={pad}
        onPointerDown={(event) => {
          active.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          update(event);
        }}
        onPointerMove={(event) => {
          if (!active.current) return;
          update(event);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        className="h-24 w-24 touch-none rounded-full border select-none"
        style={{
          borderColor: 'rgba(125,135,148,0.4)',
          backgroundColor: 'rgba(11,14,17,0.6)',
        }}
        role="application"
        aria-label={`${label}. ${hint}. Keyboard alternatives are listed under the world.`}
      >
        <div
          className="pointer-events-none relative top-1/2 left-1/2 h-9 w-9 rounded-full border"
          style={{
            borderColor: '#3ddba0',
            backgroundColor: 'rgba(61,219,160,0.18)',
            transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
          }}
        />
      </div>
      <span className="font-mono text-[9px]" style={{ color: '#7d8794' }}>
        {hint}
      </span>
    </div>
  );
}

export function FlightSticks({
  onLeft,
  onRight,
}: {
  onLeft: (axes: Axes) => void;
  onRight: (axes: Axes) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-50 flex items-end justify-between">
      <div className="pointer-events-auto">
        <Stick label="Left stick" hint="throttle · yaw" onChange={onLeft} />
      </div>
      <div className="pointer-events-auto">
        <Stick label="Right stick" hint="pitch · roll" onChange={onRight} />
      </div>
    </div>
  );
}
