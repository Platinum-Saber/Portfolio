import { site } from '@/lib/site';

/**
 * First-visit splash - the full Chip Cut logo assembling itself.
 *
 * Rendered on every page but `display: none` unless SPLASH_SCRIPT (below,
 * inlined in <head> by the root layout) sets `data-splash` on <html>. That
 * script runs once per browser tab session, before first paint, so there is
 * no flash of the page and no hydration involved. With JavaScript off, for
 * crawlers and on every later page load the splash never appears.
 *
 * This is a deliberate exception to DESIGN-LANGUAGE rule 5 ("first paint is
 * content") - see the Decision Log, 2026-09-26. It is kept to ~1.4 s,
 * never blocks input once fading, and under reduced motion shows the finished
 * logo briefly instead of animating it.
 *
 * Geometry is the Flat Dark "Classic" logo from branding/, on its 512 grid.
 */
const SILVER = '#C4C9CE';
const GREEN = '#3DDBA0';
const INK = '#0B0D10';

function Chip() {
  const pins = [180, 218, 256, 294, 332];
  return (
    <>
      <rect
        x="156"
        y="156"
        width="200"
        height="200"
        rx="18"
        fill="#1A1F25"
        stroke={SILVER}
        strokeWidth="10"
      />
      <g fill={SILVER}>
        {pins.map((q) => (
          <g key={q}>
            <rect x={q - 7} y="116" width="14" height="34" rx="3" />
            <rect x={q - 7} y="362" width="14" height="34" rx="3" />
            <rect x="116" y={q - 7} width="34" height="14" rx="3" />
            <rect x="362" y={q - 7} width="34" height="14" rx="3" />
          </g>
        ))}
      </g>
      <circle cx="190" cy="190" r="9" fill={GREEN} />
    </>
  );
}

export function Splash() {
  return (
    <div id="ps-splash" aria-hidden="true">
      <svg viewBox="8 8 496 496" width="148" height="148">
        <defs>
          <clipPath id="psl-cu">
            <polygon points="0,0 512,0 0,512" />
          </clipPath>
          <clipPath id="psl-cl">
            <polygon points="512,0 512,512 0,512" />
          </clipPath>
        </defs>
        <circle cx="256" cy="256" r="240" fill={INK} />
        <circle
          className="psl-ring"
          cx="256"
          cy="256"
          r="240"
          fill="none"
          stroke={SILVER}
          strokeWidth="10"
          transform="rotate(-90 256 256)"
        />
        <g className="psl-chip">
          <g className="psl-upper" clipPath="url(#psl-cu)">
            <Chip />
          </g>
          <g className="psl-lower" clipPath="url(#psl-cl)">
            <Chip />
          </g>
        </g>
        <line
          className="psl-blade"
          x1="166"
          y1="346"
          x2="392"
          y2="120"
          stroke={GREEN}
          strokeWidth="13"
          strokeLinecap="round"
        />
        <line
          className="psl-blade"
          x1="166"
          y1="346"
          x2="392"
          y2="120"
          stroke="#E6FFF5"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <g
          className="psl-hilt"
          transform="translate(166 346) rotate(135) scale(1.18)"
          fill={SILVER}
        >
          <path d="M 0 -15 L 14 -12 L 14 12 L 0 15 Z" />
          <rect x="14" y="-11" width="58" height="22" rx="3" />
          {[38, 44.5, 51, 57.5, 64].map((x) => (
            <rect
              key={x}
              x={x}
              y="-11"
              width="3"
              height="22"
              fill={INK}
              opacity="0.6"
            />
          ))}
          <rect x="20" y="-16" width="11" height="6" rx="2" fill={GREEN} />
          <rect x="72" y="-14" width="14" height="28" rx="6" />
        </g>
      </svg>
      <p className="psl-name">{site.name}</p>
    </div>
  );
}

/**
 * Decides, before first paint, whether this tab has seen the splash. Runs
 * inline and synchronously in <head>, like the theme script. Timings must
 * match the keyframes in globals.css (`#ps-splash`).
 */
export const SPLASH_SCRIPT = `(function(){try{if(sessionStorage.getItem('ps-splash'))return;sessionStorage.setItem('ps-splash','1');var d=document.documentElement,r=window.matchMedia('(prefers-reduced-motion: reduce)').matches;d.setAttribute('data-splash','on');setTimeout(function(){d.setAttribute('data-splash','out')},r?700:1400);setTimeout(function(){d.removeAttribute('data-splash')},r?1000:1850);}catch(e){}})();`;
