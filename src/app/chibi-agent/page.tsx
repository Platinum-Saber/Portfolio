import type { Metadata } from 'next';
import { ChibiStory } from '@/components/chibi/ChibiStory';
import { DeepDive } from '@/components/chibi/DeepDive';

/**
 * /chibi-agent: Raphael, the Chibi-Agent desktop companion, from character to
 * architecture.
 *
 * Unlisted for now (2026-10-24): not in the nav, not in the sitemap, and
 * noindex. Linking it means adding it to `nav` in lib/site.ts and to
 * app/sitemap.ts, and dropping `robots` below.
 */
export const metadata: Metadata = {
  title: 'Raphael - Chibi-Agent',
  description:
    'A local AI companion for the Windows desktop: a Live2D character with voice, memory, desktop tools and briefings, all running on one laptop.',
  robots: { index: false, follow: false },
};

export default function ChibiAgentPage() {
  return (
    <>
      <ChibiStory />
      <DeepDive />
    </>
  );
}
