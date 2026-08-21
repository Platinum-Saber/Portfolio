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
      className="rounded-full px-2 py-0.5 font-mono text-[11px]"
      style={
        isActive
          ? { backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }
          : { backgroundColor: 'var(--bg-subtle)', color: 'var(--fg-muted)' }
      }
    >
      {LABELS[status]}
    </span>
  );
}
