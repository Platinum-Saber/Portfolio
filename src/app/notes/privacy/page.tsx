import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy' };

/**
 * Privacy notice for the notes sign-in. Public (outside the middleware
 * matcher) because Google's OAuth consent screen links to it. Keep it true to
 * the code: if sign-in starts storing anything, this page changes first.
 */
export default function NotesPrivacyPage() {
  return (
    <article className="nb-card nb-privacy">
      <p className="nb-eyebrow">Notes · Privacy</p>
      <h1 className="nb-display">Privacy</h1>
      <p className="nb-lead">
        How the Notes sign-in at {site.url.replace('https://', '')}/notes
        handles your data. Last updated 7 November 2026.
      </p>

      <h2 className="nb-h2">What sign-in receives</h2>
      <p>
        When you choose <strong>Continue with Google</strong>, Google tells this
        site your <strong>name</strong> and <strong>email address</strong>, and
        whether Google has verified that address. Nothing else is requested: no
        contacts, files, calendar or other Google data.
      </p>

      <h2 className="nb-h2">What it is used for</h2>
      <p>
        Only to check that the address is a verified{' '}
        <strong>@cse.mrt.ac.lk</strong> address. If it is, you can read the
        notes; if not, you are sent back to the sign-in page.
      </p>

      <h2 className="nb-h2">What is stored, and where</h2>
      <ul>
        <li>
          <strong>In your browser only:</strong> a signed session cookie holding
          your email address and name, which expires after seven days or when
          you sign out. The site keeps{' '}
          <strong>no account and no database</strong> of who signed in.
        </li>
        <li>
          <strong>In your browser only:</strong> study progress (sections marked
          done), Summary/Detailed view and text size, in local storage. They
          never leave your device.
        </li>
        <li>
          <strong>Hosting logs:</strong> the site runs on Cloudflare, whose
          request logs (such as IP address and pages requested) are kept briefly
          for operating and securing the service.
        </li>
      </ul>

      <h2 className="nb-h2">Sharing</h2>
      <p>Your data is not sold, shared or used for advertising or tracking.</p>

      <h2 className="nb-h2">Removing it</h2>
      <p>
        Use <strong>Sign out</strong>, or clear this site&apos;s cookies and
        local storage. You can also remove the app&apos;s access at{' '}
        <a href="https://myaccount.google.com/connections" className="nb-link">
          myaccount.google.com/connections
        </a>
        .
      </p>

      <h2 className="nb-h2">Contact</h2>
      <p>
        <a href={`mailto:${site.email}`} className="nb-link">
          {site.email}
        </a>
      </p>

      <p className="nb-fine">
        <Link href="/notes/login" className="nb-link">
          ← Back to sign-in
        </Link>
      </p>
    </article>
  );
}
