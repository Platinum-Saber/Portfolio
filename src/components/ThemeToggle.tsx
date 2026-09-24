'use client';

/**
 * Reads and writes the `data-theme` attribute the no-flash script in layout.tsx
 * already set. Deliberately holds no React state: the current theme lives in the
 * DOM, and CSS picks which icon to show. That means no hydration mismatch, no
 * effect on mount, and no flash of the wrong icon.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private mode or blocked storage — the toggle still works for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle colour theme"
      title="Toggle colour theme"
      className="glass glass-btn glass-press grid size-9 place-items-center"
      style={{ color: 'var(--fg-muted)' }}
    >
      {/* Moon — shown in light mode, i.e. "switch to dark" */}
      <svg
        className="dark:hidden"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>

      {/* Sun — shown in dark mode, i.e. "switch to light" */}
      <svg
        className="hidden dark:block"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
