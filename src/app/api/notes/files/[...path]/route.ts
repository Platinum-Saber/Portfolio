import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, readSession } from '@/lib/notes/auth';

export const dynamic = 'force-dynamic';

/**
 * Members-only file downloads (the full PDF notes).
 *
 * The files live in public/notes-files/, so they ship as Worker static assets.
 * wrangler.jsonc sets `run_worker_first` for /notes-files/*, which means a
 * visitor's request for one reaches the Worker (and the middleware rewrites
 * it here) instead of being answered by the asset store. Here, after the
 * session check, the bytes are read through the ASSETS binding - a binding
 * fetch goes straight to the store and is not routed back to the Worker.
 *
 * Under `next dev` / `next start` there is no ASSETS binding, so the file is
 * read from disk.
 */
const SAFE = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/i;

const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  webp: 'image/webp',
  png: 'image/png',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return new Response('Sign in with a cse.mrt.ac.lk account to read this.', {
      status: 401,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const rel = (await params).path.join('/');
  const ext = rel.split('.').pop()?.toLowerCase() ?? '';
  if (!SAFE.test(rel) || rel.includes('..') || !TYPES[ext]) {
    return new Response('Not found', { status: 404 });
  }

  const body = await readAsset(req, `/notes-files/${rel}`);
  if (!body) return new Response('Not found', { status: 404 });

  return new Response(body, {
    headers: {
      'Content-Type': TYPES[ext],
      // The reference site's choice: a week in the reader's own cache, never
      // in a shared one.
      'Cache-Control': 'private, max-age=604800',
      'Content-Disposition': `inline; filename="${rel.split('/').pop()}"`,
      'X-Robots-Tag': 'noindex',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function readAsset(
  req: NextRequest,
  path: string,
): Promise<BodyInit | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = getCloudflareContext();
    const assets = (env as { ASSETS?: { fetch: typeof fetch } }).ASSETS;
    if (assets) {
      const r = await assets.fetch(new URL(path, req.url));
      return r.ok ? r.body : null;
    }
  } catch {
    // Not on Workers (next dev / next start): fall through to the disk.
  }
  // `next dev` / `next start`. On Workers this finds nothing (no filesystem).
  try {
    const fs = await import('node:fs/promises');
    const nodePath = await import('node:path');
    const buf = await fs.readFile(nodePath.join(process.cwd(), 'public', path));
    return new Uint8Array(buf) as unknown as BodyInit;
  } catch {
    return null;
  }
}
