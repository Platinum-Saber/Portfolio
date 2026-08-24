import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { site } from '@/lib/site';

/**
 * The portrait is inlined as a data URI, read from disk at build time. Satori
 * cannot fetch a relative URL — there is no origin while the card is being
 * rendered — and it does not decode WebP, hence a small dedicated JPEG rather
 * than reusing the two files the site itself serves.
 */
const PORTRAIT = `data:image/jpeg;base64,${fs
  .readFileSync(path.join(process.cwd(), 'public', 'images', 'portrait-og.jpg'))
  .toString('base64')}`;

export const alt = site.title;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#0b0d10',
        padding: '80px',
      }}
    >
      <div
        style={{
          display: 'flex',
          color: '#3ddba0',
          fontSize: 26,
          letterSpacing: 2,
        }}
      >
        {site.location.toUpperCase()}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
        <img
          src={PORTRAIT}
          alt=""
          width={210}
          height={210}
          style={{ borderRadius: 4, border: '1px solid #232830' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              color: '#e8eaed',
              fontSize: 68,
              fontWeight: 600,
              letterSpacing: -2,
            }}
          >
            {site.fullName}
          </div>
          <div style={{ color: '#9aa1ac', fontSize: 32, marginTop: 16 }}>
            Robotics · Embedded Systems · Perception
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', color: '#5f6570', fontSize: 24 }}>
        github.com/Platinum-Saber
      </div>
    </div>,
    size,
  );
}
