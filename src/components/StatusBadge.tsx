import type { ProjectStatus } from '@/lib/projects';

const LABELS: Record<ProjectStatus, string> = {
  'in-progress': 'In progress',
  complete: 'Complete',
  archived: 'Archived',
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const isActive = status === 'in-progress';
  return (
    <span
      // 9.0d: a glass tag; a live project's is tinted with the accent.
      className={`glass glass-chip px-2 py-0.5 font-mono text-[11px] ${isActive ? 'glass-accent' : ''}`}
      style={isActive ? undefined : { color: 'var(--fg-muted)' }}
    >
      {LABELS[status]}
    </span>
  );
}
