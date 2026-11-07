/**
 * Static diagrams for the guides. Server components, plain SVG - no JS ships.
 * Colours come from the neo-brutalist variables so they follow the theme.
 */

export const INK = 'var(--nb-ink)';
const CARD = 'var(--nb-card)';
export const T = { fontFamily: 'var(--nb-display)', fontWeight: 900 } as const;
export const M = { fontFamily: 'var(--font-mono)', fontSize: 12 } as const;

export function Frame({
  title,
  children,
  viewBox,
}: {
  title: string;
  children: React.ReactNode;
  viewBox: string;
}) {
  return (
    <figure className="nb-diagram">
      <svg viewBox={viewBox} role="img" aria-label={title}>
        <defs>
          <marker
            id="nb-arr"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="14"
            markerHeight="14"
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={INK} />
          </marker>
        </defs>
        {children}
      </svg>
      <figcaption>{title}</figcaption>
    </figure>
  );
}

export function Box({
  x,
  y,
  w,
  h,
  fill,
  label,
  sub,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  label: string;
  sub?: string;
}) {
  return (
    <g>
      <rect x={x + 5} y={y + 5} width={w} height={h} rx={8} fill={INK} />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        fill={fill}
        stroke={INK}
        strokeWidth={3}
      />
      <text
        x={x + w / 2}
        y={y + (sub ? h / 2 - 4 : h / 2 + 5)}
        textAnchor="middle"
        fontSize={15}
        fill="#111"
        style={T}
      >
        {label}
      </text>
      {sub && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 14}
          textAnchor="middle"
          fill="#111"
          style={M}
        >
          {sub}
        </text>
      )}
    </g>
  );
}

/** §0 - the loop every method in the module runs. */
export function LoopDiagram() {
  const y = 40,
    h = 64,
    w = 128;
  return (
    <Frame
      title="Every iterative method is this loop; methods differ in the two yellow boxes."
      viewBox="0 0 760 210"
    >
      <Box
        x={10}
        y={y}
        w={100}
        h={h}
        fill="var(--nb-mint)"
        label="x⁽⁰⁾"
        sub="start"
      />
      <Box
        x={150}
        y={y}
        w={w}
        h={h}
        fill="var(--nb-yellow)"
        label="Direction"
        sub="d = −S g"
      />
      <Box
        x={318}
        y={y}
        w={w}
        h={h}
        fill="var(--nb-yellow)"
        label="Step size"
        sub="α: exact / Wolfe"
      />
      <Box
        x={486}
        y={y}
        w={w}
        h={h}
        fill="var(--nb-blue)"
        label="Move"
        sub="x ← x + αd"
      />
      <Box
        x={654}
        y={y}
        w={96}
        h={h}
        fill="var(--nb-pink)"
        label="Stop?"
        sub="‖g‖, Δf, k"
      />
      {[110, 278, 446, 614].map((x) => (
        <line
          key={x}
          x1={x + 4}
          y1={y + h / 2}
          x2={x + 36}
          y2={y + h / 2}
          stroke={INK}
          strokeWidth={3}
          markerEnd="url(#nb-arr)"
        />
      ))}
      <path
        d={`M702 ${y + h + 8} V170 H214 V${y + h + 12}`}
        fill="none"
        stroke={INK}
        strokeWidth={3}
        markerEnd="url(#nb-arr)"
      />
      <text x={458} y={162} textAnchor="middle" fill={INK} style={M}>
        no - repeat from the new point
      </text>
      <text x={702} y={24} textAnchor="middle" fill={INK} style={M}>
        yes → x*
      </text>
    </Frame>
  );
}

/** §1 - the same objective, three feasible sets. */
export function FeasibleDiagram() {
  // World → SVG: x ∈ [−1, 4], y ∈ [−4, 3] onto 360 × 300 with origin offset.
  const X = (x: number) => 40 + (x + 1) * 64;
  const Y = (y: number) => 20 + (3 - y) * 40;
  const rings = [1, 2, 3, 4, 5];
  return (
    <Frame
      title="f = (x₁ − 2)² + (x₂ + 3)² + 1: unconstrained minimum (2, −3); on the triangle it moves to (2, 0), the closest feasible point."
      viewBox="0 0 400 320"
    >
      <rect x={0} y={0} width={400} height={320} fill={CARD} />
      {rings.map((r) => (
        <ellipse
          key={r}
          cx={X(2)}
          cy={Y(-3)}
          rx={r * 64}
          ry={r * 40}
          fill="none"
          stroke={INK}
          strokeOpacity={0.35}
          strokeWidth={1.5}
        />
      ))}
      <line
        x1={X(-1)}
        y1={Y(0)}
        x2={X(4)}
        y2={Y(0)}
        stroke={INK}
        strokeWidth={1.5}
      />
      <line
        x1={X(0)}
        y1={Y(-4)}
        x2={X(0)}
        y2={Y(3)}
        stroke={INK}
        strokeWidth={1.5}
      />
      <polygon
        points={`${X(0)},${Y(0)} ${X(2)},${Y(0)} ${X(0)},${Y(2)}`}
        fill="var(--nb-mint)"
        stroke={INK}
        strokeWidth={3}
      />
      <text x={X(0.35)} y={Y(0.55)} fill="#111" style={M}>
        F
      </text>
      <circle
        cx={X(2)}
        cy={Y(-3)}
        r={8}
        fill="var(--nb-pink)"
        stroke={INK}
        strokeWidth={2.5}
      />
      <text x={X(2) + 12} y={Y(-3) + 4} fill={INK} style={M}>
        (2, −3) f = 1
      </text>
      <circle
        cx={X(2)}
        cy={Y(0)}
        r={8}
        fill="var(--nb-yellow)"
        stroke={INK}
        strokeWidth={2.5}
      />
      <text x={X(2) + 12} y={Y(0) - 8} fill={INK} style={M}>
        x* = (2, 0) f = 10
      </text>
      <text x={X(3.6)} y={Y(0) + 16} fill={INK} style={M}>
        x₁
      </text>
      <text x={X(0) + 6} y={Y(2.8)} fill={INK} style={M}>
        x₂
      </text>
    </Frame>
  );
}

/** §10 - KKT geometry at a vertex: −∇f lies in the cone of the active constraint normals. */
export function KktDiagram() {
  const vx = 220,
    vy = 150;
  return (
    <Frame
      title="At a KKT point, −∇f is a non-negative combination of the active constraint normals: −∇f = μ₁∇g₁ + μ₂∇g₂, μ ≥ 0. If −∇f pointed outside the cone, a feasible descent direction would exist."
      viewBox="0 0 400 300"
    >
      <rect x={0} y={0} width={400} height={300} fill={CARD} />
      <polygon
        points={`40,270 ${vx},${vy} 90,40 20,60`}
        fill="var(--nb-mint)"
        stroke={INK}
        strokeWidth={3}
      />
      <text x={70} y={160} fill="#111" style={M}>
        feasible
      </text>
      <text x={60} y={185} fill="#111" style={M}>
        g ≤ 0
      </text>
      <path
        d={`M${vx} ${vy} L${vx + 150} ${vy - 110} A190 190 0 0 1 ${vx + 140} ${vy + 120} Z`}
        fill="var(--nb-yellow)"
        fillOpacity={0.6}
        stroke="none"
      />
      <line
        x1={vx}
        y1={vy}
        x2={vx + 120}
        y2={vy - 88}
        stroke={INK}
        strokeWidth={3}
        markerEnd="url(#nb-arr)"
      />
      <text x={vx + 112} y={vy - 96} fill={INK} style={M}>
        ∇g₁
      </text>
      <line
        x1={vx}
        y1={vy}
        x2={vx + 110}
        y2={vy + 94}
        stroke={INK}
        strokeWidth={3}
        markerEnd="url(#nb-arr)"
      />
      <text x={vx + 108} y={vy + 116} fill={INK} style={M}>
        ∇g₂
      </text>
      <line
        x1={vx}
        y1={vy}
        x2={vx + 140}
        y2={vy + 10}
        stroke="var(--nb-red)"
        strokeWidth={5}
        markerEnd="url(#nb-arr)"
      />
      <text x={vx + 112} y={vy + 34} fill={INK} style={M}>
        −∇f
      </text>
      <circle
        cx={vx}
        cy={vy}
        r={8}
        fill="var(--nb-pink)"
        stroke={INK}
        strokeWidth={2.5}
      />
      <text x={vx - 26} y={vy - 14} fill={INK} style={M}>
        x*
      </text>
      <text
        x={vx + 72}
        y={vy - 30}
        fill={INK}
        style={{ ...M, fontWeight: 700 }}
      >
        cone
      </text>
    </Frame>
  );
}
