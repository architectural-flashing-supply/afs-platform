'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PipelineStage } from '@/lib/data/command-center-dashboard';

interface OrderPipelineFunnelProps {
  stages: PipelineStage[];
}

/**
 * Horizontal funnel: each stage's bar width is proportional to its count
 * against the first (largest) stage, so the drop-off between steps reads
 * visually, not just numerically. Hover reveals the stage-over-stage
 * percentage (spec: "Hover expands to show details").
 */
export default function OrderPipelineFunnel({ stages }: OrderPipelineFunnelProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-1">
      {stages.map((stage, idx) => {
        const widthPct = Math.max(6, Math.round((stage.count / maxCount) * 100));
        const prev = idx > 0 ? stages[idx - 1] : null;
        const pctOfPrev = prev && prev.count > 0 ? Math.round((stage.count / prev.count) * 100) : null;

        return (
          <Link
            key={stage.key}
            href={stage.href}
            className="flex-1 min-w-0 group"
            onMouseEnter={() => setHovered(stage.key)}
            onMouseLeave={() => setHovered((h) => (h === stage.key ? null : h))}
          >
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid">{stage.label}</p>
              <p className="font-heading text-lg text-afs-chrome-high group-hover:text-afs-danger-on-dark transition-colors">
                {stage.count}
              </p>
            </div>
            <div className="h-2.5 w-full bg-afs-bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-afs-crimson rounded-full transition-all group-hover:opacity-80"
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <p className="font-body text-[11px] text-afs-chrome-silver mt-1 h-4">
              {hovered === stage.key && pctOfPrev !== null ? `${pctOfPrev}% of ${prev!.label}` : ''}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
