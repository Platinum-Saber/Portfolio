'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** The neo-brutalist card every simulation sits in. */
export function SimFrame({
  title,
  hint,
  controls,
  children,
  readout,
}: {
  title: string;
  hint?: string;
  controls?: ReactNode;
  children: ReactNode;
  readout?: ReactNode;
}) {
  return (
    <figure className="nb-sim">
      <figcaption className="nb-sim-head">
        <span className="nb-sim-badge">SIM</span>
        <span className="nb-sim-title">{title}</span>
      </figcaption>
      {controls && <div className="nb-sim-controls">{controls}</div>}
      <div className="nb-sim-stage">{children}</div>
      {readout && <div className="nb-sim-readout">{readout}</div>}
      {hint && <p className="nb-sim-hint">{hint}</p>}
    </figure>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  log,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Log-scale slider: min/max are the real values, the track is log10. */
  log?: boolean;
  format?: (v: number) => string;
}) {
  const t = log ? Math.log10(value) : value;
  return (
    <label className="nb-slider">
      <span className="nb-slider-label">
        {label} <b>{format ? format(value) : value}</b>
      </span>
      <input
        type="range"
        min={log ? Math.log10(min) : min}
        max={log ? Math.log10(max) : max}
        step={log ? 0.01 : (step ?? 0.01)}
        value={t}
        onChange={(e) => {
          const x = Number(e.target.value);
          onChange(log ? Number((10 ** x).toPrecision(3)) : x);
        }}
      />
    </label>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="nb-select">
      <span className="nb-slider-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Canvas that tracks its container width (aspect fixed) and the theme. */
export function useCanvasSize(aspect: number, maxH = 420) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 560, h: Math.min(maxH, 560 * aspect) });
  const [theme, setTheme] = useState(0);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.max(240, Math.floor(e.contentRect.width));
      setSize({ w, h: Math.min(maxH, Math.round(w * aspect)) });
    });
    ro.observe(el);
    const mo = new MutationObserver(() => setTheme((t) => t + 1));
    // The site theme lives on <html>; the guide reader's own theme
    // (data-rtheme) on an element below it - watch both.
    mo.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-theme', 'data-rtheme'],
    });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [aspect, maxH]);
  return { wrap, ...size, theme };
}

export function Legend({
  items,
}: {
  items: { color: string; label: string; value?: string }[];
}) {
  return (
    <ul className="nb-legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className="nb-swatch" style={{ background: i.color }} />
          {i.label}
          {i.value && <b>{i.value}</b>}
        </li>
      ))}
    </ul>
  );
}

/**
 * A step counter that snaps back to 0 whenever `key` (the parameters) changes,
 * without an effect: the stored step only counts while its key still matches.
 */
export function useKeyedStep(key: string) {
  const [st, setSt] = useState({ key, k: 0 });
  const k = st.key === key ? st.k : 0;
  const setK = (f: number | ((k: number) => number)) =>
    setSt((prev) => {
      const cur = prev.key === key ? prev.k : 0;
      return { key, k: typeof f === 'function' ? f(cur) : f };
    });
  return [k, setK] as const;
}
