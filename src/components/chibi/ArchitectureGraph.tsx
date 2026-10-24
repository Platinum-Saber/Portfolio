'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { core, nodes, pathToHash, type ChibiNode } from '@/lib/chibi/graph';

type Props = {
  /** The open node's address, ids from the top (e.g. ['voice', 'cloned']); [] for the overview. */
  path: string[];
  onPath: (path: string[]) => void;
  onHover: (id: string | null) => void;
  /** False while the scroll story is still drawing the graph: no focus, no clicks. */
  interactive: boolean;
  /** The thinking core, drawn in the middle of the world so it zooms with it. */
  coreSlot: ReactNode;
};

type Size = { w: number; h: number };
type Pt = { x: number; y: number };
type Placed = { node: ChibiNode; path: string[]; at: Pt; level: number };

/** DOM id of a node's button, for focus handling (paths contain '/'). */
export const nodeDomId = (path: string[]) => `chibi-node-${path.join('-')}`;

const same = (a: string[], b: string[]) => pathToHash(a) === pathToHash(b);

/**
 * The architecture as a tree you walk into. The core sits in the middle with
 * the eleven top-level parts on a ring. Opening a part that is made of several
 * pieces grows those pieces out of it as nodes of their own; opening one of
 * them zooms further in. Isolated features are leaves and open straight to
 * their details.
 *
 * It is DOM, not canvas: nodes are real buttons and edges are SVG, so text
 * stays crisp at any zoom and the keyboard works. Zooming is one CSS transform
 * on the whole world.
 */
export function ArchitectureGraph({ path, onPath, onHover, interactive, coreSlot }: Props) {
  const host = useRef<HTMLDivElement>(null);
  // Unknown until measured: the graph is laid out from the stage's real size,
  // and rendering it on the server would only produce a layout to throw away
  // (and float digits that differ between Node and the browser).
  const [size, setSize] = useState<Size | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!size) return <div ref={host} className="chibi-graph absolute inset-0" />;

  const compact = size.w < 640;
  const c: Pt = { x: Math.round(size.w / 2), y: Math.round(size.h / 2) };

  // The ring.
  const ry = compact ? Math.min(size.w * 0.38, size.h * 0.3) : Math.min(size.h * 0.34, size.w * 0.26);
  const rx = compact ? ry * 1.02 : ry * 1.45;
  const ring: Placed[] = nodes.map((n) => {
    const a = ((n.angle ?? 0) * Math.PI) / 180;
    return { node: n, path: [n.id], level: 1, at: { x: Math.round(c.x + rx * Math.sin(a)), y: Math.round(c.y - ry * Math.cos(a)) } };
  });
  const placedCore: Placed = { node: core, path: [core.id], level: 1, at: c };

  // The open chain: each opened node's children fan out of it, away from its parent.
  const chain: Placed[] = [];
  const branches: Placed[] = [];
  let from: Pt = c;
  for (let d = 0; d < path.length; d++) {
    const want = path.slice(0, d + 1);
    const here = (d === 0 ? [placedCore, ...ring] : branches).find((p) => same(p.path, want));
    if (!here) break;
    chain.push(here);
    const kids = here.node.children ?? [];
    if (kids.length) {
      // Phones always fan upward (the detail sheet covers the bottom). Wide
      // screens fan away from the parent, and leftward out of the core.
      const base = compact
        ? -Math.PI / 2
        : d === 0 && here.node.id === core.id
          ? Math.PI
          : Math.atan2(here.at.y - from.y, here.at.x - from.x);
      const dist = (compact ? 84 : 132) / (1 + 0.35 * d);
      const step = Math.min(0.75, (Math.PI * 0.95) / Math.max(1, kids.length - 1));
      kids.forEach((k, j) => {
        const a = base + (j - (kids.length - 1) / 2) * step;
        branches.push({
          node: k,
          path: [...here.path, k.id],
          level: d + 2,
          at: { x: Math.round(here.at.x + Math.cos(a) * dist), y: Math.round(here.at.y + Math.sin(a) * dist) },
        });
      });
    }
    from = here.at;
  }

  // Zoom: onto the open node; with its parts showing, onto the node and its fan together.
  const open = chain.at(-1) ?? null;
  const fan = open ? branches.filter((b) => b.path.length === open.path.length + 1) : [];
  let world: CSSProperties = { transform: 'none' };
  if (open) {
    const k = Math.min(2.6, (compact ? 1.4 : 1.6) * (1 + 0.3 * (open.path.length - 1)));
    const focusAt = fan.length
      ? {
          x: (open.at.x + fan.reduce((t, b) => t + b.at.x, 0) / fan.length) / 2,
          y: (open.at.y + fan.reduce((t, b) => t + b.at.y, 0) / fan.length) / 2,
        }
      : open.at;
    const f = compact ? { x: size.w / 2, y: size.h * 0.24 } : { x: Math.max(size.w * 0.3, (size.w - 440) / 2), y: size.h / 2 };
    world = { transform: `translate(${f.x - focusAt.x * k}px, ${f.y - focusAt.y * k}px) scale(${k})` };
  }

  const onChain = (p: string[]) => chain.some((x) => same(x.path, p));
  const active = (p: string[]) => !open || onChain(p) || fan.some((b) => same(b.path, p));
  const coreSize = Math.min(size.w, size.h) * (compact ? 0.34 : 0.3);
  // Clicking the open node again closes it; clicking anything else opens that.
  const toggle = (p: string[]) => onPath(same(p, path) ? p.slice(0, -1) : p);
  const all = [placedCore, ...ring, ...branches];

  const button = (p: Placed, i: number) => {
    const kids = p.node.children?.length ?? 0;
    return (
      <button
        key={pathToHash(p.path)}
        type="button"
        id={nodeDomId(p.path)}
        className="chibi-node absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
        style={{ left: p.at.x, top: p.at.y, '--i': i } as CSSProperties}
        data-level={p.level}
        data-on={onChain(p.path) ? '' : undefined}
        data-dim={active(p.path) ? undefined : ''}
        aria-expanded={same(p.path, path)}
        aria-controls="chibi-panel"
        aria-label={`${p.node.label}: ${p.node.tagline}${kids ? ` (${kids} parts)` : ''}`}
        onClick={() => toggle(p.path)}
        onPointerEnter={() => onHover(p.node.id)}
        onPointerLeave={() => onHover(null)}
        onFocus={() => onHover(p.node.id)}
        onBlur={() => onHover(null)}
      >
        <span className="chibi-node-dot grid place-items-center font-mono" aria-hidden>
          {p.node.glyph}
        </span>
        <span className="chibi-node-label font-medium whitespace-nowrap">{p.node.label}</span>
        {!compact && p.level === 1 && (
          <span className="chibi-node-tag max-w-[11rem] text-center text-[11px] leading-snug">{p.node.tagline}</span>
        )}
      </button>
    );
  };

  return (
    <div
      ref={host}
      className="chibi-graph absolute inset-0"
      data-zoomed={open ? '' : undefined}
      onClick={(e) => {
        // A click on empty space (not a node or the core) goes back up one level.
        if (open && !(e.target as HTMLElement).closest('button')) onPath(path.slice(0, -1));
      }}
    >
      <div className="chibi-world absolute inset-0 origin-top-left" style={world} inert={!interactive}>
        <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {ring.map((p, i) => (
            <g key={p.node.id} style={{ '--i': i } as CSSProperties}>
              <line
                className="chibi-edge"
                data-on={onChain(p.path) ? '' : undefined}
                data-dim={active(p.path) ? undefined : ''}
                x1={c.x}
                y1={c.y}
                x2={p.at.x}
                y2={p.at.y}
                pathLength={1}
              />
              {/* Stubs hint at parts still folded inside; leaves have none. */}
              {!onChain(p.path) &&
                stubs(p, c, compact).map((s, j) => (
                  <line key={j} className="chibi-stub" x1={p.at.x} y1={p.at.y} x2={s.x} y2={s.y} />
                ))}
            </g>
          ))}
          {branches.map((b) => {
            const up = all.find((x) => same(x.path, b.path.slice(0, -1)));
            return up ? (
              <line
                key={pathToHash(b.path)}
                className="chibi-branch-edge"
                data-on={onChain(b.path) ? '' : undefined}
                x1={up.at.x}
                y1={up.at.y}
                x2={b.at.x}
                y2={b.at.y}
              />
            ) : null;
          })}
        </svg>

        <div className="absolute" style={{ left: c.x - coreSize / 2, top: c.y - coreSize / 2, width: coreSize, height: coreSize }}>
          {coreSlot}
          <button
            type="button"
            id={nodeDomId([core.id])}
            className="chibi-core-hit absolute inset-[22%] rounded-full"
            aria-label={`${core.label}: ${core.tagline} (${core.children?.length ?? 0} parts)`}
            aria-expanded={same(path, [core.id])}
            aria-controls="chibi-panel"
            onClick={() => toggle([core.id])}
            onPointerEnter={() => onHover(core.id)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(core.id)}
            onBlur={() => onHover(null)}
          />
          <span className="chibi-core-label pointer-events-none absolute inset-x-0 -bottom-1 text-center font-mono text-[11px] tracking-[0.18em] uppercase">
            {core.label}
          </span>
        </div>

        {ring.map(button)}
        {branches.map(button)}
      </div>
    </div>
  );
}

/** Short lines out of a ring node, one per folded part, pointing away from the core. */
function stubs(p: Placed, c: Pt, compact: boolean): Pt[] {
  const count = p.node.children?.length ?? 0;
  const base = Math.atan2(p.at.y - c.y, p.at.x - c.x);
  const len = compact ? 30 : 40;
  return Array.from({ length: count }, (_, j) => {
    const a = base + (j - (count - 1) / 2) * 0.32;
    return { x: p.at.x + Math.cos(a) * len, y: p.at.y + Math.sin(a) * len };
  });
}
