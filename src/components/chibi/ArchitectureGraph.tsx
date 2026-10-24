'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { core, nodes, nodeById, type ChibiNode } from '@/lib/chibi/graph';

type Props = {
  selected: string | null;
  onSelect: (id: string | null) => void;
  onBranch: (id: string) => void;
  onHover: (id: string | null) => void;
  /** False while the scroll story is still drawing the graph: no focus, no clicks. */
  interactive: boolean;
  /** The thinking core, drawn in the middle of the world so it zooms with it. */
  coreSlot: ReactNode;
};

type Size = { w: number; h: number };
type Pt = { x: number; y: number };

/** Where the zoomed-in node lands, leaving room for the detail panel. */
function focusPoint({ w, h }: Size, compact: boolean): Pt {
  return compact ? { x: w / 2, y: h * 0.25 } : { x: Math.max(w * 0.3, (w - 440) / 2), y: h / 2 };
}

function layout({ w, h }: Size, compact: boolean) {
  const ry = compact ? Math.min(w * 0.38, h * 0.3) : Math.min(h * 0.34, w * 0.26);
  const rx = compact ? ry * 1.02 : ry * 1.45;
  const pos = new Map<string, Pt>([[core.id, { x: w / 2, y: h / 2 }]]);
  for (const n of nodes) {
    const a = (n.angle * Math.PI) / 180;
    pos.set(n.id, { x: Math.round(w / 2 + rx * Math.sin(a)), y: Math.round(h / 2 - ry * Math.cos(a)) });
  }
  return pos;
}

/**
 * The architecture as a graph: the core in the middle, ten subsystems on a
 * ring, each with its own branches.
 *
 * It is DOM, not canvas: nodes are real buttons and edges are SVG, so text
 * stays crisp at any zoom, Tab and Enter work, and screen readers get labels.
 * Zooming is one CSS transform on the whole world.
 */
export function ArchitectureGraph({ selected, onSelect, onBranch, onHover, interactive, coreSlot }: Props) {
  const host = useRef<HTMLDivElement>(null);
  // Unknown until measured: the graph is laid out from the stage's real size,
  // and rendering it on the server would only produce a layout to throw away
  // (and float digits that differ between Node and the browser).
  const [size, setSize] = useState<Size | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!size) return <div ref={host} className="chibi-graph absolute inset-0" />;
  const compact = size.w < 640;
  const pos = layout(size, compact);
  const sel = selected ? nodeById(selected) : null;
  const selPos = sel ? pos.get(sel.id)! : null;
  const k = compact ? 1.45 : 1.65;
  const world: CSSProperties = selPos
    ? (() => {
        const f = focusPoint(size, compact);
        return { transform: `translate(${f.x - selPos.x * k}px, ${f.y - selPos.y * k}px) scale(${k})` };
      })()
    : { transform: 'none' };
  const c = pos.get(core.id)!;
  const coreSize = Math.min(size.w, size.h) * (compact ? 0.34 : 0.3);

  return (
    <div
      ref={host}
      className="chibi-graph absolute inset-0"
      data-zoomed={sel ? '' : undefined}
      onClick={(e) => {
        // A click on empty space (not a node, branch or the core) zooms back out.
        if (sel && !(e.target as HTMLElement).closest('button')) onSelect(null);
      }}
    >
      <div className="chibi-world absolute inset-0 origin-top-left" style={world} inert={!interactive}>
        <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {nodes.map((n, i) => {
            const p = pos.get(n.id)!;
            return (
              <g key={n.id} style={{ '--i': i } as CSSProperties}>
                <line
                  className="chibi-edge"
                  data-on={sel?.id === n.id ? '' : undefined}
                  x1={c.x}
                  y1={c.y}
                  x2={p.x}
                  y2={p.y}
                  pathLength={1}
                />
                {stubs(n, p, c, compact).map((s, j) => (
                  <line key={j} className="chibi-stub" x1={p.x} y1={p.y} x2={s.x} y2={s.y} />
                ))}
              </g>
            );
          })}
        </svg>

        <div
          className="absolute"
          style={{ left: c.x - coreSize / 2, top: c.y - coreSize / 2, width: coreSize, height: coreSize }}
        >
          {coreSlot}
          <button
            type="button"
            className="chibi-core-hit absolute inset-[22%] rounded-full"
            aria-label={`${core.label}: ${core.tagline}`}
            aria-expanded={sel?.id === core.id}
            aria-controls="chibi-panel"
            onClick={() => onSelect(sel?.id === core.id ? null : core.id)}
            onPointerEnter={() => onHover(core.id)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(core.id)}
            onBlur={() => onHover(null)}
          />
          <span className="chibi-core-label pointer-events-none absolute inset-x-0 -bottom-1 text-center font-mono text-[11px] tracking-[0.18em] uppercase">
            {core.label}
          </span>
        </div>

        {nodes.map((n, i) => {
          const p = pos.get(n.id)!;
          const on = sel?.id === n.id;
          return (
            <button
              key={n.id}
              type="button"
              id={`chibi-node-${n.id}`}
              className="chibi-node absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
              style={{ left: p.x, top: p.y, '--i': i } as CSSProperties}
              data-on={on ? '' : undefined}
              data-dim={sel && !on ? '' : undefined}
              aria-expanded={on}
              aria-controls="chibi-panel"
              onClick={() => onSelect(on ? null : n.id)}
              onPointerEnter={() => onHover(n.id)}
              onPointerLeave={() => onHover(null)}
              onFocus={() => onHover(n.id)}
              onBlur={() => onHover(null)}
            >
              <span className="chibi-node-dot grid place-items-center font-mono" aria-hidden>
                {n.glyph}
              </span>
              <span className="text-[13px] font-medium whitespace-nowrap">{n.label}</span>
              {!compact && (
                <span className="chibi-node-tag max-w-[11rem] text-center text-[11px] leading-snug">
                  {n.tagline}
                </span>
              )}
            </button>
          );
        })}

        {/* Phones list the branches in the bottom sheet instead: a fan of chips
            would not fit beside the node at that width. */}
        {sel &&
          selPos &&
          !compact &&
          branchSpots(sel, selPos, compact).map(({ b, p }) => (
            <button
              key={b.id}
              type="button"
              className="chibi-branch glass-chip absolute -translate-x-1/2 -translate-y-1/2 font-mono whitespace-nowrap"
              style={{ left: p.x, top: p.y }}
              onClick={() => onBranch(b.id)}
            >
              {b.label}
            </button>
          ))}
      </div>
    </div>
  );
}

/** Outward direction from the core (straight down for the core itself). */
function outward(p: Pt, c: Pt): number {
  return p.x === c.x && p.y === c.y ? Math.PI / 2 : Math.atan2(p.y - c.y, p.x - c.x);
}

/** Short lines fanning out of a node: one per branch, so the ring reads as a tree. */
function stubs(n: ChibiNode, p: Pt, c: Pt, compact: boolean): Pt[] {
  const base = outward(p, c);
  const len = compact ? 14 : 22;
  const count = n.branches.length;
  return n.branches.map((_, j) => {
    const a = base + (j - (count - 1) / 2) * 0.32;
    return { x: p.x + Math.cos(a) * (len + 18), y: p.y + Math.sin(a) * (len + 18) };
  });
}

/**
 * Where a zoomed node's branch chips sit: a fan pointing away from the detail
 * panel (left of the node on wide screens, above it on phones), so the panel
 * never covers them.
 */
function branchSpots(n: ChibiNode, p: Pt, compact: boolean) {
  const base = compact ? -Math.PI / 2 : Math.PI;
  const count = n.branches.length;
  const spread = compact ? 0.5 : 0.38;
  const dist = compact ? 62 : 92;
  const dir = compact ? 1 : -1; // read top to bottom on wide screens, left to right on phones
  return n.branches.map((b, j) => {
    const a = base + dir * (j - (count - 1) / 2) * spread;
    return { b, p: { x: p.x + Math.cos(a) * dist, y: p.y + Math.sin(a) * dist } };
  });
}
