'use client';

import { useEffect, useState } from 'react';
import ProfileLibraryBrowser, { type LibraryProfileCardData } from '@/components/studio/ProfileLibraryBrowser';
import CanonicalProfileBrowser, { type CanonicalProfileCardData } from '@/components/studio/CanonicalProfileBrowser';

type Tab = 'machine' | 'canonical';

export default function ProfileLibraryTabs({
  machineProfiles,
  machineCategories,
}: {
  machineProfiles: LibraryProfileCardData[];
  machineCategories: string[];
}) {
  const [tab, setTab] = useState<Tab>('machine');
  const [canonicalProfiles, setCanonicalProfiles] = useState<CanonicalProfileCardData[] | null>(null);
  const [canonicalLoading, setCanonicalLoading] = useState(false);
  const [canonicalError, setCanonicalError] = useState(false);

  useEffect(() => {
    if (tab !== 'canonical' || canonicalProfiles !== null || canonicalLoading) return;
    setCanonicalLoading(true);
    fetch('/api/studio/canonical-profiles')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load canonical profiles.');
        return res.json();
      })
      .then((data: { profiles: CanonicalProfileCardData[] }) => {
        setCanonicalProfiles(data.profiles ?? []);
      })
      .catch(() => setCanonicalError(true))
      .finally(() => setCanonicalLoading(false));
  }, [tab, canonicalProfiles, canonicalLoading]);

  const tabClass = (active: boolean) =>
    `font-label text-sm font-semibold px-5 py-2.5 rounded transition-colors ${
      active
        ? 'bg-afs-crimson text-white'
        : 'bg-afs-bg-overlay text-afs-chrome-mid border border-afs-border hover:bg-afs-bg-surface'
    }`;

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button type="button" onClick={() => setTab('machine')} className={tabClass(tab === 'machine')}>
          Machine Profiles
        </button>
        <button type="button" onClick={() => setTab('canonical')} className={tabClass(tab === 'canonical')}>
          Canonical Profiles
        </button>
      </div>

      {tab === 'machine' && <ProfileLibraryBrowser profiles={machineProfiles} categories={machineCategories} />}

      {tab === 'canonical' && (
        <>
          {canonicalLoading && <p className="font-body text-sm text-afs-chrome-mid py-12 text-center">Loading canonical profiles...</p>}
          {canonicalError && (
            <p className="font-body text-sm text-afs-crimson py-12 text-center">Could not load canonical profiles.</p>
          )}
          {canonicalProfiles && <CanonicalProfileBrowser profiles={canonicalProfiles} />}
        </>
      )}
    </div>
  );
}
