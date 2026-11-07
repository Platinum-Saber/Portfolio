import { redirect } from 'next/navigation';

// The middleware already redirects /notes; this covers any environment
// where it does not run.
export default function NotesIndex() {
  redirect('/notes/cse');
}
