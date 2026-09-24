import { site } from '@/lib/site';

/**
 * The operator portrait - Phase 8.2.
 *
 * A plain <img> with a two-source srcset rather than `next/image`. The site's
 * architecture is "nothing on the render path depends on a service", and
 * `next/image` routes every request through Vercel's optimiser (a quota, and
 * a network hop). These two files are pre-built by hand at exactly the sizes
 * the site uses - 8 KB and 21 KB - so there is nothing left to optimise at
 * runtime.
 *
 * `width`/`height` are set so the box is reserved before the bytes land: a
 * portrait that pops in and shoves the fields down is a layout shift on the
 * one element above the fold.
 */
export function Portrait({ size }: { size: number }) {
  return (
    // Deliberately not next/image - see the note above.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/portrait-256.webp"
      srcSet="/images/portrait-256.webp 256w, /images/portrait-512.webp 512w"
      sizes={`${size}px`}
      width={size}
      height={size}
      alt={site.fullName}
      className="rounded-sm border object-cover"
      style={{ borderColor: 'var(--border)', width: size, height: size }}
      decoding="async"
    />
  );
}
