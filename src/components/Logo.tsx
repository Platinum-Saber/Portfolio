import { useId } from 'react';

/**
 * The Platinum-Saber mark - a chip cut in two by a green saber - as drawn for
 * the title bar.
 *
 * Same design as the Flat Dark "Classic" logo in branding/, redrawn on a
 * 64-unit grid for ~30px: three pins a side instead of five, and every
 * stroke thickened so the rim, package outline and hilt still read at that
 * size. Inline rather than an <img> so it costs no request and stays sharp
 * at any device pixel ratio.
 *
 * Decorative: the link it sits in already carries the name.
 */
const SILVER = '#C4C9CE';
const GREEN = '#3DDBA0';
const INK = '#0B0D10';

function Chip() {
  const pins = [24.25, 30.25, 36.25];
  return (
    <>
      <g fill={SILVER}>
        {pins.map((p) => (
          <g key={p}>
            <rect x={p} y="12.5" width="3.5" height="7" rx="1" />
            <rect x={p} y="44.5" width="3.5" height="7" rx="1" />
            <rect x="12.5" y={p} width="7" height="3.5" rx="1" />
            <rect x="44.5" y={p} width="7" height="3.5" rx="1" />
          </g>
        ))}
      </g>
      <rect
        x="20"
        y="20"
        width="24"
        height="24"
        rx="3.5"
        fill="#1A1F25"
        stroke={SILVER}
        strokeWidth="3"
      />
      <circle cx="26" cy="26" r="2.2" fill={GREEN} />
    </>
  );
}

export function Logo({
  size = 30,
  className,
  animated = false,
}: {
  size?: number;
  className?: string;
  /** Loop the loading animation (styles in globals.css, `.ps-logo-anim`). */
  animated?: boolean;
}) {
  // Clip-path ids must be unique per document; strip the punctuation React
  // puts in useId() so the value is safe inside url(#...).
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={[animated ? 'ps-logo-anim' : '', className]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={`${id}u`}>
          <polygon points="0,0 64,0 0,64" />
        </clipPath>
        <clipPath id={`${id}l`}>
          <polygon points="64,0 64,64 0,64" />
        </clipPath>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="30.5"
        fill={INK}
        stroke={SILVER}
        strokeWidth="3"
      />
      {/* The package, split along the cut and pushed apart. */}
      <g
        className="psl-upper"
        clipPath={`url(#${id}u)`}
        transform="translate(-2.6 -2.6)"
      >
        <Chip />
      </g>
      <g
        className="psl-lower"
        clipPath={`url(#${id}l)`}
        transform="translate(2.6 2.6)"
      >
        <Chip />
      </g>
      {/* Blade, then its bright core. */}
      <line
        className="psl-blade"
        x1="21"
        y1="43"
        x2="50"
        y2="14"
        stroke={GREEN}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <line
        className="psl-blade"
        x1="21"
        y1="43"
        x2="50"
        y2="14"
        stroke="#E6FFF5"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* Classic hilt: emitter, ridged grip, switch, pommel. */}
      <g transform="translate(21 43) rotate(135)" fill={SILVER}>
        <path d="M0 -3 L2.6 -2.4 L2.6 2.4 L0 3 Z" />
        <rect x="2.6" y="-2.2" width="7.6" height="4.4" rx=".6" />
        {[6, 7.6, 9.2].map((x) => (
          <rect
            key={x}
            x={x}
            y="-2.2"
            width=".9"
            height="4.4"
            fill={INK}
            opacity=".6"
          />
        ))}
        <rect x="3.4" y="-3.5" width="2" height="1.2" rx=".4" fill={GREEN} />
        <rect x="10.2" y="-2.7" width="2.6" height="5.4" rx="1.1" />
      </g>
    </svg>
  );
}
