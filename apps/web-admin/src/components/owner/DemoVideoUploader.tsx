'use client';

import { CSSProperties, useRef, useState } from 'react';

interface DemoVideoUploaderProps {
  machineId: string;
  currentVideoUrl: string | null;
  onUploadComplete: (url: string) => void;
}

const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = ['video/mp4'];

const containerStyle: CSSProperties = {
  backgroundColor: 'var(--color-bg-raised)',
  borderRadius: 12,
  padding: 16,
};

const dropZoneStyle: CSSProperties = {
  border: '2px dashed var(--color-border-default)',
  borderRadius: 10,
  padding: 24,
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.2s ease',
};

const dropZoneActiveStyle: CSSProperties = {
  ...dropZoneStyle,
  borderColor: 'var(--color-blue)',
  backgroundColor: 'rgba(59, 130, 246, 0.05)',
};

export function DemoVideoUploader({ machineId, currentVideoUrl, onUploadComplete }: DemoVideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Only MP4 (H.264) videos are accepted';
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File too large. Maximum is ${MAX_SIZE_MB}MB`;
    }
    return null;
  };

  const handleUpload = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('video', file);

      const res = await fetch(`/api/machine/${machineId}/demo-video`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      setProgress(100);
      onUploadComplete(data.video_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <div style={containerStyle}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 14 }}>🎬</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Demo Video
        </span>
      </div>

      {/* Current video preview */}
      {currentVideoUrl && !uploading && (
        <div style={{
          marginBottom: 12,
          borderRadius: 8,
          overflow: 'hidden',
          aspectRatio: '16/10',
          backgroundColor: 'var(--color-bg-base)',
        }}>
          <video
            src={currentVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Upload zone */}
      <div
        style={dragActive ? dropZoneActiveStyle : dropZoneStyle}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {uploading ? (
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              Uploading...
            </div>
            <div style={{
              width: '100%',
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: 'var(--color-blue)',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>📹</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>
              {currentVideoUrl ? 'Replace video' : 'Upload demo video'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              MP4 H.264 · 720p+ · Max {MAX_SIZE_MB}MB
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 8,
          fontSize: 12,
          color: 'var(--color-red)',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          borderRadius: 6,
          padding: '6px 10px',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
