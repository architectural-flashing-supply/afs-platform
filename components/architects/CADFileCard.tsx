'use client';

import { useState } from 'react';
import Link from 'next/link';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';

export type CADFileFormat = 'dwg' | 'dxf' | 'pdf' | 'rfa' | 'rvt';

export interface CADFile {
  id: string;
  profileId: string;
  profileName: string;
  format: CADFileFormat;
  filename: string;
  description: string | null;
  fileSizeBytes: number | null;
  version: string | null;
  revitVersion: string | null;
  downloadCount: number;
}

interface CADFileCardProps {
  file: CADFile;
  isAuthenticated: boolean;
}

const FORMAT_LABEL: Record<CADFileFormat, string> = {
  dwg: 'DWG',
  dxf: 'DXF',
  pdf: 'PDF',
  rfa: 'RVT',
  rvt: 'RVT',
};

// Format is a semantic file-type indicator, not the AFS brand accent —
// crimson is intentionally excluded from this shell (copper accent only).
const FORMAT_BADGE_VARIANT: Record<CADFileFormat, BadgeVariant> = {
  dwg: 'info',
  dxf: 'success',
  pdf: 'warning',
  rfa: 'chrome',
  rvt: 'chrome',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CADFileCard({ file, isAuthenticated }: CADFileCardProps) {
  const [loading, setLoading] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRevit = file.format === 'rfa' || file.format === 'rvt';

  async function handleDownload() {
    if (!isAuthenticated) {
      setShowSignIn(true);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/documents/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: file.id }),
      });
      if (!res.ok) {
        setError('Could not prepare this download. Please try again.');
        return;
      }
      const data = (await res.json()) as { signedUrl: string };
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Could not prepare this download. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge metal-edge-copper overflow-hidden flex flex-col"
      data-testid="cad-file-card"
    >
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-3">
          <Badge variant={FORMAT_BADGE_VARIANT[file.format]}>{FORMAT_LABEL[file.format]}</Badge>
          {isRevit && file.revitVersion && (
            <span className="font-data text-xs text-afs-ink-700">Revit {file.revitVersion}</span>
          )}
        </div>

        <h3 className="font-heading text-lg text-afs-ink-900 mb-1">{file.profileName}</h3>
        {file.description && (
          <p className="font-body text-sm text-afs-ink-700 mb-4 line-clamp-2">{file.description}</p>
        )}

        <div className="flex items-center gap-3 flex-wrap font-data text-xs text-afs-ink-700 mb-5">
          {file.fileSizeBytes != null && <span>{formatFileSize(file.fileSizeBytes)}</span>}
          {file.version && <span>v{file.version}</span>}
          <span>
            Downloaded {file.downloadCount} time{file.downloadCount === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mt-auto">
          {showSignIn ? (
            <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-3">
              <p className="font-body text-xs text-afs-ink-700 mb-3">
                Sign in to download technical drawings.
              </p>
              <div className="flex gap-2">
                <Link
                  href="/login?redirect=/architects/cad-library"
                  className="flex-1 text-center bg-afs-copper hover:bg-afs-copper-hover text-white font-label text-xs font-semibold px-3 py-2 rounded transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="flex-1 text-center border border-afs-border text-afs-ink-700 hover:bg-afs-bg-overlay font-label text-xs font-semibold px-3 py-2 rounded transition-colors"
                >
                  Create Account
                </Link>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading}
              className="w-full bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold text-sm px-4 py-2.5 rounded transition-colors disabled:opacity-50"
            >
              {loading ? 'Preparing…' : 'Download'}
            </button>
          )}
          {error && <p className="font-body text-xs text-afs-crimson mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}
