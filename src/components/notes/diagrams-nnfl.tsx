/**
 * MA4144 (neural networks and fuzzy logic) diagrams. Server components, plain SVG.
 */
import { Box, Frame, INK, M, T } from './diagrams';

const Arrow = ({ x1, y1, x2, y2, dash, col = INK }: { x1: number; y1: number; x2: number; y2: number; dash?: boolean; col?: string }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={2.5} markerEnd="url(#nb-arr)" strokeDasharray={dash ? '6 5' : undefined} />
);
const Label = ({ x, y, children, anchor = 'middle', size }: { x: number; y: number; children: React.ReactNode; anchor?: 'start' | 'middle' | 'end'; size?: number }) => (
  <text x={x} y={y} textAnchor={anchor} fill={INK} style={{ ...M, ...(size ? { fontSize: size } : {}) }}>
    {children}
  </text>
);
const Node = ({ x, y, r = 20, fill, label, sub }: { x: number; y: number; r?: number; fill: string; label: string; sub?: string }) => (
  <g>
    <circle cx={x + 3} cy={y + 3} r={r} fill={INK} />
    <circle cx={x} cy={y} r={r} fill={fill} stroke={INK} strokeWidth={3} />
    <text x={x} y={y + (sub ? 0 : 5)} textAnchor="middle" fill="#111" style={T} fontSize={14}>{label}</text>
    {sub && <text x={x} y={y + 14} textAnchor="middle" fill="#111" style={M} fontSize={10}>{sub}</text>}
  </g>
);

/** One artificial neuron: weighted sum plus bias, then the activation. */
export function NeuronDiagram() {
  const ys = [50, 105, 160, 215];
  const xs = ['x₁', 'x₂', '⋮', 'xₙ'];
  return (
    <Frame title="A neuron: net input y_in = b + Σ wᵢxᵢ = wᵀx + b, output y = f(y_in). The bias is a weight on a constant input of 1." viewBox="0 0 760 270">
      {ys.map((y, i) => (
        <g key={i}>
          {xs[i] !== '⋮' ? <Node x={60} y={y} r={18} fill="var(--nb-mint)" label={xs[i]} /> : <text x={60} y={y + 6} textAnchor="middle" fill={INK} style={T}>⋮</text>}
          {xs[i] !== '⋮' && <Arrow x1={80} y1={y} x2={300} y2={135} />}
          {xs[i] !== '⋮' && <Label x={150} y={y + (y < 135 ? -6 : -10) + (i === 1 ? 2 : 0)}>{`w${['₁', '₂', '', 'ₙ'][i]}`}</Label>}
        </g>
      ))}
      <Node x={180} y={245} r={14} fill="var(--nb-yellow)" label="1" />
      <Arrow x1={194} y1={238} x2={302} y2={150} />
      <Label x={262} y={218}>b</Label>
      <circle cx={333} cy={138} r={32} fill={INK} />
      <circle cx={330} cy={135} r={32} fill="var(--nb-yellow)" stroke={INK} strokeWidth={3} />
      <text x={330} y={146} textAnchor="middle" fill="#111" style={T} fontSize={30}>Σ</text>
      <Arrow x1={362} y1={135} x2={440} y2={135} />
      <Label x={400} y={124}>y_in</Label>
      <Box x={444} y={103} w={120} h={64} fill="var(--nb-blue)" label="f( · )" sub="activation" />
      <Arrow x1={566} y1={135} x2={660} y2={135} />
      <Node x={690} y={135} r={22} fill="var(--nb-pink)" label="y" />
    </Frame>
  );
}

/** XOR: two hidden lines carve the square; the output unit combines them. */
export function XorDiagram() {
  const S = 170, ox = 40, oy = 40;
  const P = (x: number, y: number) => [ox + x * S, oy + (1 - y) * S] as const;
  const pts: [number, number, number][] = [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]];
  return (
    <Frame title="XOR is not linearly separable: no single line splits the 1s from the 0s. A 2-2-1 network uses two hidden lines (z₁: x₁ + x₂ ≥ 0.5, z₂: x₁ + x₂ ≥ 1.5) and the output fires for 'z₁ AND NOT z₂' - the band between them." viewBox="0 0 760 260">
      <rect x={ox} y={oy} width={S} height={S} fill="var(--nb-card)" stroke={INK} strokeWidth={2} />
      <polygon points={`${P(0, 0.5)[0]},${P(0, 0.5)[1]} ${P(0.5, 0)[0]},${P(0.5, 0)[1]} ${P(1, 0.5)[0]},${P(1, 0.5)[1]} ${P(0.5, 1)[0]},${P(0.5, 1)[1]}`} fill="var(--nb-mint)" opacity={0.55} />
      <line x1={P(-0.1, 0.6)[0]} y1={P(-0.1, 0.6)[1]} x2={P(0.6, -0.1)[0]} y2={P(0.6, -0.1)[1]} stroke="var(--nb-blue)" strokeWidth={3} strokeDasharray="7 5" />
      <line x1={P(0.4, 1.1)[0]} y1={P(0.4, 1.1)[1]} x2={P(1.1, 0.4)[0]} y2={P(1.1, 0.4)[1]} stroke="var(--nb-orange)" strokeWidth={3} strokeDasharray="7 5" />
      {pts.map(([x, y, t]) => (
        <g key={`${x}${y}`}>
          <circle cx={P(x, y)[0]} cy={P(x, y)[1]} r={13} fill={t ? 'var(--nb-mint)' : 'var(--nb-pink)'} stroke={INK} strokeWidth={2.5} />
          <text x={P(x, y)[0]} y={P(x, y)[1] + 5} textAnchor="middle" fill="#111" style={T} fontSize={13}>{t}</text>
        </g>
      ))}
      <Label x={P(0.05, 0.08)[0] + 70} y={P(0, 0)[1] + 28}>x₁ →</Label>
      <Label x={ox - 22} y={oy + S / 2}>x₂</Label>
      <Label x={P(0.62, 0.1)[0] + 30} y={P(0.62, 0.1)[1]} anchor="start">z₁</Label>
      <Label x={P(1.1, 0.4)[0] + 6} y={P(1.1, 0.4)[1]} anchor="start">z₂</Label>
      {/* the network */}
      <Node x={420} y={80} r={18} fill="var(--nb-mint)" label="x₁" />
      <Node x={420} y={190} r={18} fill="var(--nb-mint)" label="x₂" />
      <Node x={560} y={80} r={20} fill="var(--nb-blue)" label="z₁" sub="OR" />
      <Node x={560} y={190} r={20} fill="var(--nb-orange)" label="z₂" sub="AND" />
      <Node x={690} y={135} r={22} fill="var(--nb-pink)" label="y" />
      {[[80, 80], [80, 190], [190, 80], [190, 190]].map(([a, b], i) => (
        <Arrow key={i} x1={440} y1={a} x2={538} y2={b + (b > a ? -6 : b < a ? 6 : 0)} />
      ))}
      <Arrow x1={582} y1={86} x2={668} y2={128} />
      <Arrow x1={582} y1={184} x2={668} y2={142} />
      <Label x={630} y={92}>+1</Label>
      <Label x={630} y={192}>−1</Label>
      <Label x={690} y={180}>θ = 0.5</Label>
    </Frame>
  );
}

/** MADALINE with two hidden ADALINEs and a fixed OR output (MR-I). */
export function MadalineDiagram() {
  return (
    <Frame title="MADALINE (MR-I): hidden ADALINEs Z₁, Z₂ with bipolar step outputs; the output Y is a fixed OR unit (v₁ = v₂ = b_y = ½). Only the hidden weights are trained." viewBox="0 0 760 250">
      <Node x={90} y={70} r={20} fill="var(--nb-mint)" label="X₁" />
      <Node x={90} y={180} r={20} fill="var(--nb-mint)" label="X₂" />
      <Node x={330} y={70} r={26} fill="var(--nb-yellow)" label="Z₁" sub="ADALINE" />
      <Node x={330} y={180} r={26} fill="var(--nb-yellow)" label="Z₂" sub="ADALINE" />
      <Node x={570} y={125} r={26} fill="var(--nb-pink)" label="Y" sub="OR" />
      <Arrow x1={112} y1={70} x2={302} y2={70} />
      <Arrow x1={112} y1={180} x2={302} y2={180} />
      <Arrow x1={110} y1={80} x2={305} y2={170} />
      <Arrow x1={110} y1={170} x2={305} y2={80} />
      <Label x={200} y={62}>w₁₁</Label>
      <Label x={200} y={198}>w₂₂</Label>
      <Label x={140} y={98}>w₁₂</Label>
      <Label x={140} y={168}>w₂₁</Label>
      <Arrow x1={358} y1={78} x2={545} y2={118} />
      <Arrow x1={358} y1={172} x2={545} y2={132} />
      <Label x={450} y={86}>v₁ = ½</Label>
      <Label x={450} y={176}>v₂ = ½</Label>
      <Arrow x1={598} y1={125} x2={690} y2={125} />
      <Label x={660} y={115}>y</Label>
      <Label x={330} y={235}>trainable (MR-I)</Label>
      <Label x={570} y={185}>fixed: b_y = ½</Label>
    </Frame>
  );
}

/** Backpropagation: forward signals, backward δ terms. */
export function BackpropDiagram() {
  return (
    <Frame title="Backpropagation: the forward pass computes z_j and y_k; the error terms flow back - δ_k = (t_k − y_k) f′(y_in,k) at the output, δ_j = f′(z_in,j) Σ_k δ_k w_jk at the hidden layer - and every weight moves by α × (its δ) × (the signal on its input side)." viewBox="0 0 760 290">
      {[60, 145, 230].map((y, i) => <Node key={`x${i}`} x={80} y={y} r={18} fill="var(--nb-mint)" label={['x₁', 'xᵢ', 'xₙ'][i]} />)}
      {[80, 210].map((y, i) => <Node key={`z${i}`} x={330} y={y} r={22} fill="var(--nb-blue)" label={['z₁', 'z_j'][i]} />)}
      {[100, 190].map((y, i) => <Node key={`y${i}`} x={580} y={y} r={22} fill="var(--nb-pink)" label={['y₁', 'y_k'][i]} />)}
      {[60, 145, 230].flatMap((a) => [80, 210].map((b) => <line key={`${a}-${b}`} x1={98} y1={a} x2={308} y2={b} stroke={INK} strokeWidth={1.4} opacity={0.5} />))}
      {[80, 210].flatMap((a) => [100, 190].map((b) => <line key={`h${a}-${b}`} x1={352} y1={a} x2={558} y2={b} stroke={INK} strokeWidth={1.4} opacity={0.5} />))}
      <Label x={200} y={20}>v_ij</Label>
      <Label x={455} y={20}>w_jk</Label>
      <Arrow x1={130} y1={272} x2={620} y2={272} col="var(--nb-blue)" />
      <Label x={375} y={264}>forward: z_in,j = v₀ⱼ + Σ xᵢ vᵢⱼ ,  y_in,k = w₀ₖ + Σ zⱼ wⱼₖ</Label>
      <line x1={690} y1={60} x2={690} y2={230} stroke="var(--nb-red)" strokeWidth={3} />
      <Label x={705} y={150} anchor="start">t_k</Label>
      <Arrow x1={620} y1={44} x2={130} y2={44} col="var(--nb-red)" dash />
      <Label x={375} y={38}>backward: δ_k → δ_j</Label>
      <Label x={580} y={240}>Δw_jk = α δ_k z_j</Label>
      <Label x={330} y={255 - 15}>Δv_ij = α δ_j x_i</Label>
    </Frame>
  );
}

/** PNN: input → pattern → summation → output. */
export function PnnDiagram() {
  const pat = [40, 85, 130, 175, 220];
  return (
    <Frame title="A PNN stores one pattern unit per training sample (a Gaussian kernel), sums them per class to estimate f̂_k(x), and outputs the class with the largest h_k C_k f̂_k(x). Training = storing samples." viewBox="0 0 760 260">
      <Box x={20} y={100} w={100} h={56} fill="var(--nb-mint)" label="input" sub="x ∈ ℝᵈ" />
      {pat.map((y, i) => (
        <g key={i}>
          <circle cx={290} cy={y} r={16} fill={i < 3 ? 'var(--nb-blue)' : 'var(--nb-orange)'} stroke={INK} strokeWidth={2.5} />
          <line x1={122} y1={128} x2={273} y2={y} stroke={INK} strokeWidth={1.4} opacity={0.6} />
          <line x1={307} y1={y} x2={458} y2={i < 3 ? 85 : 175} stroke={INK} strokeWidth={1.4} opacity={0.6} />
        </g>
      ))}
      <Label x={290} y={250}>pattern layer: exp(−‖x − x_kj‖² / 2σ²)</Label>
      <Box x={460} y={60} w={110} h={50} fill="var(--nb-blue)" label="Σ class A" sub="f̂_A(x)" />
      <Box x={460} y={150} w={110} h={50} fill="var(--nb-orange)" label="Σ class B" sub="f̂_B(x)" />
      <Arrow x1={572} y1={85} x2={640} y2={120} />
      <Arrow x1={572} y1={175} x2={640} y2={138} />
      <Box x={642} y={100} w={104} h={56} fill="var(--nb-pink)" label="decide" sub="arg max h C f̂" />
    </Frame>
  );
}

/** Mamdani FIS pipeline. */
export function FisDiagram() {
  const steps: [string, string, string][] = [
    ['Fuzzify', 'μ_A(x₀), μ_B(y₀)', 'var(--nb-mint)'],
    ['Fire rules', 'α_i = min / max', 'var(--nb-yellow)'],
    ['Implication', 'clip or scale C_i', 'var(--nb-blue)'],
    ['Aggregate', 'μ_C = max_i μ_C′ᵢ', 'var(--nb-orange)'],
    ['Defuzzify', 'centroid → z*', 'var(--nb-pink)'],
  ];
  return (
    <Frame title="Mamdani inference. Sugeno (TSK) and Tsukamoto replace the last three boxes: each rule gives a crisp number (a function of the inputs, or μ⁻¹(α) of a monotonic set) and the output is their α-weighted average - no defuzzification step." viewBox="0 0 760 150">
      {steps.map(([a, b, c], i) => (
        <g key={a}>
          <Box x={10 + i * 150} y={40} w={128} h={64} fill={c} label={a} sub={b} />
          {i < 4 && <Arrow x1={140 + i * 150} y1={72} x2={158 + i * 150} y2={72} />}
        </g>
      ))}
      <Label x={74} y={26}>crisp x₀, y₀</Label>
      <Label x={674} y={130}>crisp z*</Label>
    </Frame>
  );
}
