'use client';

import { CSSProperties, useState } from 'react';

interface MachineDemoProps {
  demoVideoUrl: string | null;
  demoImageUrl: string | null;
  machineName: string;
}

const containerStyle: CSSProperties = {
  width: '100%',
  aspectRatio: '16/10',
  borderRadius: 12,
  backgroundColor: '#0F172A',
  border: '1px solid #334155',
  overflow: 'hidden',
  position: 'relative',
};

const mediaStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const placeholderStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  color: '#64748B',
};

const labelStyle: CSSProperties = {
  position: 'absolute',
  top: 8,
  left: 8,
  fontSize: 10,
  fontWeight: 600,
  color: '#F1F5F9',
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  borderRadius: 4,
  padding: '2px 6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export function MachineDemo({ demoVideoUrl, demoImageUrl, machineName }: MachineDemoProps) {
  const [videoError, setVideoError] = useState(false);

  // Show video if available and no error
  if (demoVideoUrl && !videoError) {
    return (
      <div style={containerStyle}>
        <div style={labelStyle}>Demo</div>
        <video
          src={demoVideoUrl}
          autoPlay
          loop
          muted
          playsInline
          style={mediaStyle}
          onError={() => setVideoError(true)}
        />
      </div>
    );
  }

  // Fallback to image
  if (demoImageUrl || (demoVideoUrl && videoError)) {
    const imgSrc = demoImageUrl ?? undefined;
    if (imgSrc) {
      return (
        <div style={containerStyle}>
          <img src={imgSrc} alt={`${machineName} demo`} style={mediaStyle} />
        </div>
      );
    }
  }

  // No media placeholder
  return (
    <div style={containerStyle}>
      <div style={placeholderStyle}>
        <span style={{ fontSize: 32, opacity: 0.4 }}>🏋️</span>
        <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          No demo available
        </span>
      </div>
    </div>
  );
}
