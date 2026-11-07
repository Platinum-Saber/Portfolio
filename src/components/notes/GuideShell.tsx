'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { GuideSection, NoteFile } from '@/lib/notes';
import { useMedia, useSiteTheme, useStored } from './reader-state';

/**
 * The guide reader: a full-screen, three-column layout that scrolls each
 * column on its own - contents on the left, the guide in the middle, the
 * original PDF on the right (wide screens only).
 *
 * Remembered in localStorage: per guide `<key>-mode`, `<key>-scale`,
 * `<key>-done`; for every guide `nb-reader-theme` and `nb-reader-panel`.
 *
 * Holds NO guide text. The content arrives as `children` - server-rendered,
 * carried in the gated RSC payload - so nothing members-only ends up in a
 * public /_next/static chunk. Never import guide content into a client file.
 */

type Mode = 'summary' | 'detailed';
type Theme = 'auto' | 'dark' | 'reading' | 'light';
type Target = { file: string; page: number };
type Ctx = { done: Set<string>; toggle: (id: string) => void };
const GuideCtx = createContext<Ctx | null>(null);

const SCALES = [0.9, 1, 1.1, 1.2, 1.3];

/** `/notes-files/cse/sem7/x.pdf#page=12` → { file, page }. */
function parseFileHref(href: string | null): Target | null {
  if (!href) return null;
  const m = /^\/notes-files\/([^#?]+\.pdf)(?:#page=(\d+))?/.exec(href);
  return m ? { file: m[1], page: m[2] ? Number(m[2]) : 1 } : null;
}

export function GuideShell({
  storageKey,
  code,
  title,
  sections,
  files,
  backHref,
  backLabel,
  tabs = [],
  children,
}: {
  tabs?: { href: string; label: string; active: boolean }[];
  storageKey: string;
  code: string;
  title: string;
  sections: GuideSection[];
  files: NoteFile[];
  backHref: string;
  backLabel: string;
  children: ReactNode;
}) {
  const [mode, setMode] = useStored<Mode>(`${storageKey}-mode`, 'summary');
  const [scale, setScale] = useStored<number>(`${storageKey}-scale`, 1);
  const [doneList, setDoneList] = useStored<string[]>(`${storageKey}-done`, []);
  const [theme, setTheme] = useStored<Theme>('nb-reader-theme', 'auto');
  const [panelPref, setPanelPref] = useStored<boolean>('nb-reader-panel', true);
  const siteTheme = useSiteTheme();
  const wide = useMedia('(min-width: 1100px)');
  const [sideOpen, setSideOpen] = useState(false);
  const [active, setActive] = useState(sections[0]?.id ?? '');
  const [sync, setSync] = useState(true);
  const first = sections.find((s) => s.file);
  const [target, setTarget] = useState<Target | null>(
    first?.file
      ? { file: first.file, page: first.page ?? 1 }
      : files[0]
        ? { file: files[0].file, page: 1 }
        : null,
  );
  const main = useRef<HTMLDivElement>(null);
  // The observer below is set up once; it reads the latest Follow state here.
  const syncRef = useRef(sync);
  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  const done = useMemo(() => new Set(doneList), [doneList]);
  const toggle = useCallback(
    (id: string) => {
      const next = new Set(done);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setDoneList([...next]);
    },
    [done, setDoneList],
  );
  const ctx = useMemo(() => ({ done, toggle }), [done, toggle]);

  const effective = theme === 'auto' ? siteTheme : theme;
  const panelOpen = wide && panelPref && target !== null;
  // PDF panel width in px, set by dragging the divider; null = the CSS default.
  const [panelW, setPanelW] = useStored<number | null>(
    'nb-reader-panel-w',
    null,
  );
  const [dragging, setDragging] = useState(false);
  const reader = useRef<HTMLDivElement>(null);
  const clampW = (w: number) => {
    const side =
      reader.current?.querySelector('.nb-r-side')?.clientWidth ?? 240;
    // Keep at least ~26rem for the guide and 18rem for the PDF.
    return Math.round(
      Math.min(window.innerWidth - side - 416, Math.max(288, w)),
    );
  };
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onDrag = (e: React.PointerEvent) => {
    if (dragging) setPanelW(clampW(window.innerWidth - e.clientX));
  };
  const onDividerKey = (e: React.KeyboardEvent) => {
    const cur =
      reader.current?.querySelector('.nb-r-panel')?.clientWidth ?? 480;
    if (e.key === 'ArrowLeft') setPanelW(clampW(cur + 32));
    else if (e.key === 'ArrowRight') setPanelW(clampW(cur - 32));
    else if (e.key === 'Home') setPanelW(null);
    else return;
    e.preventDefault();
  };
  const count = sections.filter((s) => done.has(s.id)).length;
  const pct = sections.length ? Math.round((count / sections.length) * 100) : 0;
  const step = (d: number) => {
    const i = SCALES.indexOf(scale);
    setScale(
      SCALES[Math.min(SCALES.length - 1, Math.max(0, (i < 0 ? 1 : i) + d))],
    );
  };

  // Which section is being read: highlights the contents, and moves the PDF
  // panel to that section's pages while "Follow" is on.
  useEffect(() => {
    const root = main.current;
    if (!root) return;
    const byId = new Map(sections.map((s) => [s.id, s]));
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (!hit) return;
        const id = (hit.target as HTMLElement).id;
        setActive(id);
        const s = byId.get(id);
        if (syncRef.current && s?.file)
          setTarget((t) =>
            t && t.file === s.file && t.page === (s.page ?? 1)
              ? t
              : { file: s.file!, page: s.page ?? 1 },
          );
      },
      { root, rootMargin: '-8% 0px -75% 0px' },
    );
    root.querySelectorAll('[data-section]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  // Page links and the PDF cards open in the panel when there is room for it.
  const onContentClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a || !wide || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const t = parseFileHref(a.getAttribute('href'));
    if (!t) return;
    e.preventDefault();
    setPanelPref(true);
    setSync(false);
    setTarget(t);
  };

  return (
    <GuideCtx.Provider value={ctx}>
      <div
        ref={reader}
        className="nb nb-reader"
        data-rtheme={effective}
        data-dragging={dragging || undefined}
        style={
          panelW
            ? ({
                ['--nb-panel-w' as string]: `${panelW}px`,
              } as React.CSSProperties)
            : undefined
        }
        data-panel={panelOpen ? 'open' : 'closed'}
        data-side={sideOpen ? 'open' : 'closed'}
      >
        <aside className="nb-r-side" aria-label="Guide navigation and settings">
          <div className="nb-r-side-top">
            <Link href={backHref} className="nb-r-back">
              ← {backLabel}
            </Link>
            <button
              type="button"
              className="nb-r-x nb-r-only-narrow"
              onClick={() => setSideOpen(false)}
              aria-label="Close contents"
            >
              ×
            </button>
          </div>
          <p className="nb-r-title">
            <b>{code}</b> · {title}
          </p>

          {tabs.length > 0 && (
            <nav className="nb-r-tabs" aria-label="Course parts">
              {tabs.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={t.active ? 'page' : undefined}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          )}

          <div
            className="nb-r-tools"
            role="toolbar"
            aria-label="Reading options"
          >
            <div className="nb-r-group" role="radiogroup" aria-label="Theme">
              {(
                [
                  ['dark', 'Dark theme', <Moon key="m" />],
                  ['reading', 'Reading theme', <Book key="b" />],
                  ['light', 'Light theme', <Sun key="s" />],
                ] as const
              ).map(([t, label, icon]) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={effective === t}
                  aria-label={label}
                  title={label}
                  className="nb-r-icon"
                  onClick={() => setTheme(t)}
                >
                  {icon}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="nb-r-icon"
              onClick={() => step(-1)}
              aria-label="Smaller text"
              title="Smaller text"
            >
              A−
            </button>
            <button
              type="button"
              className="nb-r-icon"
              onClick={() => step(1)}
              aria-label="Larger text"
              title={`Larger text (${Math.round(scale * 100)}%)`}
            >
              A+
            </button>
            {files.length > 0 && (
              <button
                type="button"
                className="nb-r-icon nb-r-only-wide nb-r-push"
                aria-pressed={panelOpen}
                aria-label="Original notes panel"
                title="Original notes panel"
                onClick={() => setPanelPref(!panelPref)}
              >
                <PanelIcon />
              </button>
            )}
          </div>

          <div className="nb-r-seg" role="radiogroup" aria-label="View">
            {(['summary', 'detailed'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
              >
                {m === 'summary' ? 'Summary' : 'Detailed'}
              </button>
            ))}
          </div>

          <div className="nb-r-progress">
            <span>
              {count} of {sections.length} sections done
            </span>
            <div
              className="nb-r-meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label="Sections marked done"
            >
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>

          <nav className="nb-r-toc" aria-label="Contents">
            <ol>
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    aria-current={active === s.id ? 'location' : undefined}
                    data-done={done.has(s.id) || undefined}
                    onClick={() => setSideOpen(false)}
                  >
                    <span className="nb-r-num">{s.num}</span>
                    <span className="nb-r-name">{s.title}</span>
                    {done.has(s.id) && (
                      <span className="nb-r-tick" aria-label="done">
                        ✓
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="nb-r-foot">
            <ul className="nb-r-legend">
              <li>
                <span className="nb-tag nb-tag-exam">EXAM</span> examined topic
              </li>
              <li>
                <span className="nb-tag nb-tag-calc">CALC</span> worked
                calculation
              </li>
              <li>
                <span className="nb-pdfref nb-pdfref-static">p. 12</span> opens
                the original
              </li>
            </ul>
            <div className="nb-r-foot-row">
              <Link href="/notes/cse" className="nb-r-back">
                All semesters
              </Link>
              <form action="/api/notes/auth/logout" method="post">
                <button type="submit" className="nb-r-signout">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="nb-r-main" ref={main} onClick={onContentClick}>
          <div
            className="nb-content"
            data-mode={mode}
            style={{ ['--nb-scale' as string]: scale }}
          >
            {children}
          </div>
        </div>

        {panelOpen && target && (
          <div
            className="nb-r-divider"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize the original notes panel (arrow keys; Home resets)"
            tabIndex={0}
            onPointerDown={startDrag}
            onPointerMove={onDrag}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            onDoubleClick={() => setPanelW(null)}
            onKeyDown={onDividerKey}
            title="Drag to resize · double-click to reset"
          />
        )}
        {panelOpen && target && (
          <PdfPanel
            files={files}
            target={target}
            sync={sync}
            onSync={setSync}
            onTarget={(t) => {
              setSync(false);
              setTarget(t);
            }}
            onClose={() => setPanelPref(false)}
          />
        )}

        <button
          type="button"
          className="nb-r-fab nb-r-only-narrow"
          onClick={() => setSideOpen(true)}
          aria-label="Open contents and settings"
        >
          ☰ Contents
        </button>
      </div>
    </GuideCtx.Provider>
  );
}

/**
 * The original notes, in the browser's own PDF viewer. Each page change
 * remounts the frame (`#page=` is read on load); the file itself comes from
 * the reader's private cache after the first load.
 */
function PdfPanel({
  files,
  target,
  sync,
  onSync,
  onTarget,
  onClose,
}: {
  files: NoteFile[];
  target: Target;
  sync: boolean;
  onSync: (v: boolean) => void;
  onTarget: (t: Target) => void;
  onClose: () => void;
}) {
  const meta = files.find((f) => f.file === target.file);
  const max = meta?.pages ?? 9999;
  const [draft, setDraft] = useState<string | null>(null);
  const go = (page: number) =>
    onTarget({ file: target.file, page: Math.min(max, Math.max(1, page)) });
  // toolbar=0 / navpanes=0: hide the viewer's own bar and thumbnails (Chrome,
  // Edge; Firefox ignores them) - the panel bar above does the navigation.
  const src = `/notes-files/${target.file}#page=${target.page}&toolbar=0&navpanes=0&view=FitH`;
  // The new-tab copy keeps the full viewer (zoom, search, download).
  const tabHref = `/notes-files/${target.file}#page=${target.page}`;

  return (
    <section className="nb-r-panel" aria-label="Original notes">
      <div className="nb-r-panel-bar">
        <select
          value={target.file}
          aria-label="Document"
          onChange={(e) => onTarget({ file: e.target.value, page: 1 })}
        >
          {files.map((f) => (
            <option key={f.file} value={f.file}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="nb-r-icon"
          onClick={() => go(target.page - 1)}
          aria-label="Previous page"
        >
          ‹
        </button>
        <input
          className="nb-r-page"
          inputMode="numeric"
          aria-label="Page"
          value={draft ?? String(target.page)}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={() => {
            if (draft) go(Number(draft));
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <span className="nb-r-of">/ {meta?.pages ?? '?'}</span>
        <button
          type="button"
          className="nb-r-icon"
          onClick={() => go(target.page + 1)}
          aria-label="Next page"
        >
          ›
        </button>
        <button
          type="button"
          className="nb-r-icon nb-r-follow"
          aria-pressed={sync}
          title="Follow the section you are reading"
          aria-label="Follow the section you are reading"
          onClick={() => onSync(!sync)}
        >
          ⇅
        </button>
        <a
          className="nb-r-icon"
          href={tabHref}
          target="_blank"
          rel="noopener"
          aria-label="Open in a new tab"
          title="Open in a new tab"
        >
          ↗
        </a>
        <button
          type="button"
          className="nb-r-icon"
          onClick={onClose}
          aria-label="Close panel"
          title="Close panel"
        >
          ×
        </button>
      </div>
      <iframe
        key={src}
        src={src}
        title={meta?.label ?? 'Original notes'}
        className="nb-r-frame"
      />
    </section>
  );
}

export function DoneToggle({ id }: { id: string }) {
  const ctx = useContext(GuideCtx);
  const on = !!ctx?.done.has(id);
  return (
    <button
      type="button"
      className="nb-done"
      aria-pressed={on}
      onClick={() => ctx?.toggle(id)}
    >
      {on ? '✓ Done' : 'Mark done'}
    </button>
  );
}

const svg = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;
function Moon() {
  return (
    <svg {...svg} aria-hidden="true">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}
function Book() {
  return (
    <svg {...svg} aria-hidden="true">
      <path d="M3 5.5c3-1.5 6-1.5 9 .5 3-2 6-2 9-.5V19c-3-1.5-6-1.5-9 .5-3-2-6-2-9-.5z" />
      <path d="M12 6v13.5" />
    </svg>
  );
}
function Sun() {
  return (
    <svg {...svg} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function PanelIcon() {
  return (
    <svg {...svg} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M14 4v16" />
    </svg>
  );
}
