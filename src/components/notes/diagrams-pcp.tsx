/**
 * CS4533 diagrams. Server components, plain SVG - no JS ships.
 */
import { Box, Frame, INK, M, T } from './diagrams';

const Arrow = ({ x1, y1, x2, y2, dash }: { x1: number; y1: number; x2: number; y2: number; dash?: boolean }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={2.5} markerEnd="url(#nb-arr)" strokeDasharray={dash ? '6 5' : undefined} />
);
const Label = ({ x, y, children, anchor = 'middle' }: { x: number; y: number; children: React.ReactNode; anchor?: 'start' | 'middle' | 'end' }) => (
  <text x={x} y={y} textAnchor={anchor} fill={INK} style={M}>
    {children}
  </text>
);

/** Fork/join: master forks a team, runs a parallel region, joins at the implicit barrier. */
export function ForkJoinDiagram() {
  const lanes = [60, 105, 150, 195];
  return (
    <Frame title="Fork-join: #pragma omp parallel forks a team; the implicit barrier at the end joins it." viewBox="0 0 760 250">
      <line x1={20} y1={60} x2={170} y2={60} stroke={INK} strokeWidth={5} />
      <Label x={95} y={45}>serial (master)</Label>
      <circle cx={180} cy={60} r={9} fill="var(--nb-yellow)" stroke={INK} strokeWidth={3} />
      <Label x={180} y={30}>fork</Label>
      {lanes.map((y, i) => (
        <g key={y}>
          <path d={`M189,60 C215,60 215,${y} 240,${y}`} fill="none" stroke={INK} strokeWidth={3} />
          <rect x={240} y={y - 14} width={[220, 260, 300, 180][i]} height={28} rx={6} fill={['var(--nb-mint)', 'var(--nb-blue)', 'var(--nb-pink)', 'var(--nb-orange)'][i]} stroke={INK} strokeWidth={3} />
          <text x={250} y={y + 5} fill="#111" style={M}>thread {i}{i === 0 ? ' (master)' : ''}</text>
          <line x1={240 + [220, 260, 300, 180][i]} y1={y} x2={550} y2={y} stroke={INK} strokeWidth={2} strokeDasharray="4 4" />
        </g>
      ))}
      <rect x={550} y={40} width={14} height={170} fill="var(--nb-red)" stroke={INK} strokeWidth={3} />
      <Label x={557} y={232}>barrier (join) - fast threads idle</Label>
      <line x1={564} y1={60} x2={740} y2={60} stroke={INK} strokeWidth={5} />
      <Label x={650} y={45}>serial again</Label>
    </Frame>
  );
}

/** Monitor: one lock, entry queue, condition-variable queues; Mesa signal-and-continue. */
export function MonitorDiagram() {
  return (
    <Frame title="A monitor = shared data + one mutex + condition variables. Waiting releases the mutex; with Mesa semantics a signalled thread re-queues, so re-check with while." viewBox="0 0 760 270">
      <rect x={220} y={20} width={330} height={220} rx={12} fill="var(--nb-card)" stroke={INK} strokeWidth={4} />
      <text x={385} y={46} textAnchor="middle" fill={INK} style={T} fontSize={16}>monitor (holds mutex m)</text>
      <Box x={290} y={70} w={190} h={60} fill="var(--nb-yellow)" label="shared state" sub="count, buffer[ ]" />
      <Box x={240} y={160} w={130} h={56} fill="var(--nb-blue)" label="notFull" sub="wait queue" />
      <Box x={400} y={160} w={130} h={56} fill="var(--nb-pink)" label="notEmpty" sub="wait queue" />
      <Box x={20} y={100} w={150} h={60} fill="var(--nb-mint)" label="entry queue" sub="blocked on lock(m)" />
      <Arrow x1={175} y1={130} x2={285} y2={110} />
      <Label x={200} y={150}>acquire m</Label>
      <Box x={600} y={100} w={140} h={60} fill="var(--nb-orange)" label="exit" sub="unlock(m)" />
      <Arrow x1={485} y1={100} x2={595} y2={125} />
      <path d="M305,216 C305,262 95,262 95,168" fill="none" stroke={INK} strokeWidth={2.5} strokeDasharray="6 5" markerEnd="url(#nb-arr)" />
      <Label x={180} y={258}>signal → back to the entry queue (Mesa)</Label>
    </Frame>
  );
}

/** Resource-allocation graph with a cycle. */
export function RagDiagram() {
  const proc = (x: number, y: number, l: string) => (
    <g>
      <circle cx={x} cy={y} r={28} fill="var(--nb-mint)" stroke={INK} strokeWidth={3} />
      <text x={x} y={y + 6} textAnchor="middle" fill="#111" style={T} fontSize={16}>{l}</text>
    </g>
  );
  const res = (x: number, y: number, l: string) => (
    <g>
      <rect x={x - 30} y={y - 26} width={60} height={52} rx={4} fill="var(--nb-yellow)" stroke={INK} strokeWidth={3} />
      <circle cx={x} cy={y + 8} r={5} fill={INK} />
      <text x={x} y={y - 6} textAnchor="middle" fill="#111" style={T} fontSize={15}>{l}</text>
    </g>
  );
  return (
    <Frame title="Resource-allocation graph. Request edge P → R, assignment edge R → P. With single-instance resources a cycle means deadlock (P1 → R2 → P2 → R1 → P1)." viewBox="0 0 760 240">
      {proc(150, 60, 'P1')}
      {proc(150, 180, 'P2')}
      {res(400, 60, 'R1')}
      {res(400, 180, 'R2')}
      <Arrow x1={372} y1={60} x2={182} y2={60} />
      <Label x={275} y={50}>held by</Label>
      <Arrow x1={175} y1={78} x2={370} y2={165} />
      <Label x={300} y={168}>requests</Label>
      <Arrow x1={372} y1={180} x2={182} y2={180} />
      <Label x={275} y={200}>held by</Label>
      <Arrow x1={175} y1={162} x2={370} y2={78} dash />
      <Label x={300} y={86}>requests</Label>
      <text x={500} y={60} fill={INK} style={M}>Coffman conditions</text>
      <text x={500} y={78} fill={INK} style={M}>(all four needed):</text>
      {['1. mutual exclusion', '2. hold and wait', '3. no preemption', '4. circular wait', '   ← lock ordering breaks it'].map((s, i) => (
        <text key={s} x={510} y={104 + i * 22} fill={INK} style={M}>{s}</text>
      ))}
    </Frame>
  );
}

/** MPI collectives. */
export function MpiCollectivesDiagram() {
  const cell = (x: number, y: number, v: string, fill: string) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={18} height={24} fill={fill} stroke={INK} strokeWidth={2} />
      <text x={x + 9} y={y + 17} textAnchor="middle" fill="#111" style={M}>{v}</text>
    </g>
  );
  const panel = (x0: number, title: string, before: string[][], after: string[][]) => (
    <g>
      <text x={x0 + 85} y={22} textAnchor="middle" fill={INK} style={T} fontSize={15}>{title}</text>
      {[0, 1, 2, 3].map((r) => (
        <g key={r}>
          <text x={x0} y={56 + r * 30} fill={INK} style={M}>p{r}</text>
          {before[r].map((v, k) => cell(x0 + 22 + k * 18, 40 + r * 30, v, v ? 'var(--nb-yellow)' : 'var(--nb-card)'))}
          {after[r].map((v, k) => cell(x0 + 112 + k * 18, 40 + r * 30, v, v ? 'var(--nb-mint)' : 'var(--nb-card)'))}
        </g>
      ))}
      <Arrow x1={x0 + 40} y1={176} x2={x0 + 130} y2={176} />
      <Label x={x0 + 85} y={194}>before → after</Label>
    </g>
  );
  const E = '';
  return (
    <Frame title="MPI collectives (every rank must call them): Bcast copies root's data, Scatter deals pieces out, Gather collects them, Reduce combines with an operator (here +)." viewBox="0 0 760 205">
      {panel(5, 'Bcast', [['a'], [E], [E], [E]], [['a'], ['a'], ['a'], ['a']])}
      {panel(195, 'Scatter', [['a', 'b', 'c', 'd'], [E], [E], [E]], [['a'], ['b'], ['c'], ['d']])}
      {panel(385, 'Gather', [['a'], ['b'], ['c'], ['d']], [['a', 'b', 'c', 'd'], [E], [E], [E]])}
      {panel(575, 'Reduce(+)', [['1'], ['2'], ['3'], ['4']], [['10'], [E], [E], [E]])}
    </Frame>
  );
}

/** Hand-over-hand (lock coupling) on a linked list. */
export function HandOverHandDiagram() {
  const xs = [30, 170, 310, 450, 590];
  const vals = ['head', '3', '7', '12', '20'];
  return (
    <Frame title="Fine-grained list: lock the next node before releasing the current one, so no thread can slip in between. Threads can work on different parts at once, but every step pays a lock/unlock - Lab 5 measured this ~10× slower than one coarse lock on 2 cores." viewBox="0 0 760 170">
      {xs.map((x, i) => (
        <g key={x}>
          <rect x={x} y={60} width={110} height={50} rx={6}
            fill={i === 1 || i === 2 ? 'var(--nb-orange)' : i === 3 ? 'var(--nb-blue)' : 'var(--nb-card)'}
            stroke={INK} strokeWidth={3} />
          <text x={x + 40} y={91} textAnchor="middle" fill={i === 0 || i === 4 ? INK : '#111'} style={T} fontSize={15}>{vals[i]}</text>
          <rect x={x + 80} y={60} width={30} height={50} fill="none" stroke={INK} strokeWidth={2} />
          {i < 4 && <Arrow x1={x + 95} y1={85} x2={xs[i + 1] - 4} y2={85} />}
        </g>
      ))}
      <Label x={295} y={40}>T1 holds 3 and 7 (pred, curr)</Label>
      <path d="M195,55 L195,48 L405,48 L405,55" fill="none" stroke={INK} strokeWidth={2} />
      <Label x={505} y={136}>T2 waits for 12 → 7</Label>
      <Label x={300} y={160}>step: lock(next); unlock(pred); pred = curr; curr = next</Label>
    </Frame>
  );
}
