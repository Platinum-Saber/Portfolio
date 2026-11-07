import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginCard } from '@/components/notes/LoginCard';

export const metadata: Metadata = { title: 'Sign in' };

/** The one public page of the notes section. Static; the card reads ?next / ?error itself. */
export default function NotesLoginPage() {
  return (
    <div className="nb-login">
      <div className="nb-login-intro">
        <Link href="/" className="nb-home">
          ← sansikawaduge.dev
        </Link>
        <br />
        <p className="nb-sticker nb-rot-l">CSE · UoM</p>
        <h1 className="nb-display">Notes</h1>
        <p className="nb-lead">
          Study guides for Computer Science &amp; Engineering students at the
          University of Moratuwa: summaries, worked solutions, recall prompts
          and the full notes as PDFs.
        </p>
      </div>
      <LoginCard />
    </div>
  );
}
