import { ImageResponse } from 'next/og';
import { site } from '@/lib/site';

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
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            color: '#e8eaed',
            fontSize: 76,
            fontWeight: 600,
            letterSpacing: -2,
          }}
        >
          {site.fullName}
        </div>
        <div style={{ color: '#9aa1ac', fontSize: 34, marginTop: 18 }}>
          Robotics · Embedded Systems · Perception
        </div>
      </div>
      <div style={{ display: 'flex', color: '#5f6570', fontSize: 24 }}>
        github.com/Platinum-Saber
      </div>
    </div>,
    size,
  );
}
