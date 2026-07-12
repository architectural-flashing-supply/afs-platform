'use client';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSection {
  key: string;
  title: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
}

interface ProductFilterPanelProps {
  sections: FilterSection[];
  hasActiveFilters: boolean;
  onClearAll: () => void;
  resultCount: number;
  resultNoun?: string;
}

export default function ProductFilterPanel({
  sections,
  hasActiveFilters,
  onClearAll,
  resultCount,
  resultNoun = 'results',
}: ProductFilterPanelProps) {
  return (
    <aside className="w-full lg:w-[280px] lg:shrink-0">
      <div className="lg:sticky lg:top-6 bg-afs-bg-raised border border-afs-chrome-dim rounded overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-afs-chrome-dim">
          <span className="font-heading text-sm text-afs-chrome-high uppercase tracking-wide">
            Filters
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearAll}
              className="font-body text-xs text-afs-chrome-mid hover:text-afs-crimson transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        <p className="font-data text-xs text-afs-chrome-dim px-4 pt-3">
          {resultCount} {resultNoun}
        </p>

        {sections.map((section) => (
          <details key={section.key} open className="border-b border-afs-chrome-dim last:border-b-0 group">
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between font-label text-xs uppercase tracking-wide text-afs-chrome-mid hover:text-afs-chrome-high transition-colors">
              {section.title}
              <span className="text-afs-chrome-dim group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="px-4 pb-4 flex flex-col gap-2">
              {section.options.map((opt) => {
                const checked = section.selected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 font-body text-sm text-afs-chrome-mid hover:text-afs-chrome-high cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => section.onToggle(opt.value)}
                      className="w-4 h-4 rounded border-afs-border bg-afs-bg-overlay accent-afs-crimson"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </aside>
  );
}
