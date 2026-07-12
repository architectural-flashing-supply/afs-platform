'use client';

import { useCallback, useMemo, useState } from 'react';
import ProductFilterPanel, { type FilterSection } from '@/components/product/ProductFilterPanel';
import EmptyState from '@/components/ui/EmptyState';
import CADFileCard, { type CADFile } from './CADFileCard';

interface ProfileOption {
  id: string;
  name: string;
}

interface CADLibraryBrowserProps {
  files: CADFile[];
  profileOptions: ProfileOption[];
  materialsByProfile: Record<string, string[]>;
  hasRevitFiles: boolean;
  isAuthenticated: boolean;
}

const FORMAT_OPTIONS = [
  { value: 'dwg', label: 'DWG' },
  { value: 'dxf', label: 'DXF' },
  { value: 'pdf', label: 'PDF' },
  { value: 'revit', label: 'Revit' },
];

function formatGroup(format: CADFile['format']): string {
  return format === 'rfa' || format === 'rvt' ? 'revit' : format;
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function CADLibraryBrowser({
  files,
  profileOptions,
  materialsByProfile,
  hasRevitFiles,
  isAuthenticated,
}: CADLibraryBrowserProps) {
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);

  const toggleProfile = useCallback((v: string) => setSelectedProfiles((prev) => toggleValue(prev, v)), []);
  const toggleFormat = useCallback((v: string) => setSelectedFormats((prev) => toggleValue(prev, v)), []);
  const toggleMaterial = useCallback((v: string) => setSelectedMaterials((prev) => toggleValue(prev, v)), []);
  const clearAll = useCallback(() => {
    setSelectedProfiles([]);
    setSelectedFormats([]);
    setSelectedMaterials([]);
  }, []);

  const allMaterials = useMemo(() => {
    const set = new Set<string>();
    Object.values(materialsByProfile).forEach((mats) => mats.forEach((m) => set.add(m)));
    return Array.from(set).sort();
  }, [materialsByProfile]);

  const filtered = useMemo(() => {
    return files.filter((f) => {
      if (selectedProfiles.length > 0 && !selectedProfiles.includes(f.profileId)) return false;
      if (selectedFormats.length > 0 && !selectedFormats.includes(formatGroup(f.format))) return false;
      if (selectedMaterials.length > 0) {
        const profileMaterials = materialsByProfile[f.profileId] ?? [];
        if (!selectedMaterials.some((m) => profileMaterials.includes(m))) return false;
      }
      return true;
    });
  }, [files, selectedProfiles, selectedFormats, selectedMaterials, materialsByProfile]);

  const hasActiveFilters =
    selectedProfiles.length > 0 || selectedFormats.length > 0 || selectedMaterials.length > 0;

  const sections: FilterSection[] = [
    {
      key: 'profile',
      title: 'Profile Type',
      options: profileOptions.map((p) => ({ value: p.id, label: p.name })),
      selected: selectedProfiles,
      onToggle: toggleProfile,
    },
    {
      key: 'format',
      title: 'Format',
      options: FORMAT_OPTIONS,
      selected: selectedFormats,
      onToggle: toggleFormat,
    },
  ];
  if (allMaterials.length > 0) {
    sections.push({
      key: 'material',
      title: 'Material',
      options: allMaterials.map((m) => ({ value: m, label: m })),
      selected: selectedMaterials,
      onToggle: toggleMaterial,
    });
  }

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-8">
        <ProductFilterPanel
          sections={sections}
          hasActiveFilters={hasActiveFilters}
          onClearAll={clearAll}
          resultCount={filtered.length}
          resultNoun="files"
        />

        <div className="flex-1 min-w-0">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((f) => (
                <CADFileCard key={f.id} file={f} isAuthenticated={isAuthenticated} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No files match your filters."
              description="Clear your filters, or request a detail for the profile you need."
              actionLabel="Request a Detail"
              actionHref="/architects/consultation"
              accent="copper"
            />
          )}
        </div>
      </div>

      {!hasRevitFiles && (
        <p className="font-body text-xs text-afs-ink-700 text-center mt-10">
          Revit Families — Coming Soon
        </p>
      )}
    </div>
  );
}
