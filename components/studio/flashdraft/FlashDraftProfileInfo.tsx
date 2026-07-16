'use client';

import { useState } from 'react';
import { formatInches } from '@/lib/flashdraft/geometry';
import type { FlashDraftAction, ProfileState } from '@/lib/flashdraft/types';

interface FlashDraftProfileInfoProps {
  profile: ProfileState;
  dispatch: React.Dispatch<FlashDraftAction>;
}

export default function FlashDraftProfileInfo({ profile, dispatch }: FlashDraftProfileInfoProps) {
  const [editingName, setEditingName] = useState(false);

  return (
    <div className="absolute top-2 left-2 z-40 bg-black/75 rounded-lg px-3 py-2 text-white font-mono text-xs space-y-0.5 select-none">
      {editingName ? (
        <input
          autoFocus
          value={profile.name}
          onChange={(e) => dispatch({ type: 'SET_PROFILE_NAME', name: e.target.value })}
          onBlur={() => setEditingName(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setEditingName(false);
          }}
          className="bg-transparent border-b border-white outline-none w-full text-xs font-mono"
        />
      ) : (
        <div className="font-semibold cursor-pointer hover:text-afs-accent-green" onClick={() => setEditingName(true)}>
          {profile.name}
        </div>
      )}
      <div>Blank Width: {formatInches(profile.blankWidthIn)}</div>
      <div>Bend Count: {profile.bendCount}</div>
      <div>Hem Count: {profile.hemCount}</div>
      <div>Revision: {profile.revision}</div>
    </div>
  );
}
