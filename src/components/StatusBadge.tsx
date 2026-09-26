import type { ProjectStatus } from '@/lib/projects';

const LABELS: Record<ProjectStatus, string> = {
  'in-progress': 'In progress',
  complete: 'Complete',
  archived: 'Archived',
};

const TONE: Record<ProjectStatus, string> = {
  'in-progress': 'glass-status glass-status-progress',
  complete: 'glass-status glass-status-done',
  archived: '',
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const tone = TONE[status];
  return (
    <span
      // A glass tag tinted by status: yellow in progress, green complete,
      // archived stays muted.
      className={`glass glass-chip px-2 py-0.5 font-mono text-[11px] ${tone}`}
      style={tone ? undefined : { color: 'var(--fg-muted)' }}
    >
      {LABELS[status]}
    </span>
  );
}
