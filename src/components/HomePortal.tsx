import Link from 'next/link';
import { ConsoleCard, ConsoleField } from '@/components/ConsoleCard';

/**
 * The home portal — Phase 8.6, design decision in DESIGN-LANGUAGE.md §6.5.
 *
 * The final chapter of the home sequence: a console-boot panel with a still of
 * the world and one explicit action. (Its own heading was removed in 8.9 —
 * `Chapter` supplies the label now.) **Nothing 3D is in this route's graph.** The poster is two
 * pre-built WebP files (12 KB / 5 KB) and the action is a `<Link>`, so the
 * homepage stays exactly as heavy as it was and remains complete with WebGL
 * disabled and JavaScript off.
 *
 * Auto-mounting the canvas when this section scrolled into view was proposed
 * and rejected: ~1.9 MB pushed onto a mid-range Android that did not ask for
 * it. The visitor opens the hangar door; the page does not open it for them.
 *
 * They open it ONCE, though. The link carries `?fly=1` so `/explore` starts
 * flying on arrival instead of presenting a second, identical `Take control`.
 * That is not a hole in the gate — the gate is the click that happens here.
 *
 * The poster is a real frame from `/explore`, captured from the built site —
 * not an illustration. If the world changes, re-shoot it; a portal showing a
 * place that no longer exists is worse than no portal.
 */
export function HomePortal() {
  return (
    <div className="w-full">
      <div>
        <ConsoleCard title="Flight console" meta="Standby">
          <div className="-mx-1 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/portal-1200.webp"
              srcSet="/images/portal-700.webp 700w, /images/portal-1200.webp 1200w"
              sizes="(min-width: 640px) 640px, 100vw"
              width={1200}
              height={429}
              alt="The portfolio rendered as a wireframe world, seen from behind the aircraft you fly through it."
              className="w-full rounded-sm border"
              style={{ borderColor: 'var(--border)' }}
              decoding="async"
              loading="lazy"
            />
          </div>

          <ConsoleField label="Scene">Nine zones, one aircraft, no rails</ConsoleField>
          <ConsoleField label="Controls">WASD · arrows for altitude and yaw</ConsoleField>
          <ConsoleField label="Payload">~1.9 MB, fetched only when you go</ConsoleField>
          <ConsoleField label="Fallback">Every word is on this site without it</ConsoleField>
        </ConsoleCard>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Link
          /* `?fly=1`, not a bare `/explore`. This button already says "Take
             control"; landing on `/explore`'s identical gate button and having
             to press it again is one decision asked twice, and it read as the
             first press having failed. The query string is the whole handover:
             `Explorer` takes control on mount when it is there, and `/explore`
             reached from the nav still gets its gate. */
          href="/explore?fly=1"
          /* See the note in page.tsx: on a stacked stage every link is always
             "in viewport", so this would prefetch the 3D route on page load. */
          prefetch={false}
          className="glass glass-btn glass-press glass-accent px-4 py-2 text-sm font-semibold"
        >
          ▸ Take control
        </Link>
        <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
          Or read the same nine zones as{' '}
          <Link href="/projects" className="underline underline-offset-2">
            plain pages
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
