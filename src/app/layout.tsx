import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { site } from '@/lib/site';
import './globals.css';

/*
 * Deliberately using a system font stack rather than next/font + Inter.
 * It costs zero network requests and zero layout shift, which matters against
 * the performance budget in PLAN.md. To switch to a webfont later:
 *   import { Inter } from 'next/font/google';
 *   const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
 * then put `inter.variable` back on <html>.
 */

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: `%s — ${site.name}` },
  description: site.description,
  authors: [{ name: site.fullName, url: site.url }],
  openGraph: {
    type: 'website',
    siteName: site.name,
    title: site.title,
    description: site.description,
    url: site.url,
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: site.title,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

/**
 * Applies the stored theme before first paint so the page never flashes
 * the wrong background. Must stay inline and synchronous.
 */
const NO_FLASH = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:px-3 focus:py-2"
          style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--fg)' }}
        >
          Skip to content
        </a>
        <Nav />
        <main id="main" className="mx-auto max-w-3xl px-5 py-14">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
