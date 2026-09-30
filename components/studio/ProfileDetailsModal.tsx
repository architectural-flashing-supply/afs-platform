'use client';

import { useState } from 'react';
import { AFS_PROFILE_CATEGORIES } from '@/lib/data/profile-categories';

export interface ProfileDetailsFormValues {
  name: string;
  /**
   * The chosen AFS product category, as a plain name from
   * AFS_PROFILE_CATEGORIES, or null for "None".
   *
   * Historically this held a UUID pointing at the old machine profile
   * library's category table; that library was removed in Command Center V2
   * prompt v2-01, so the value is now the category name itself. The key is
   * still called `categoryId` because it is the persisted field name inside
   * `saved_configurations.dimensions`, and renaming a stored key buys
   * nothing.
   */
  categoryId: string | null;
  subcategory: string;
}

interface ProfileDetailsModalProps {
  initialValues: ProfileDetailsFormValues;
  onCancel: () => void;
  onSave: (values: ProfileDetailsFormValues) => void;
  saving: boolean;
  error: string | null;
}

export default function ProfileDetailsModal({ initialValues, onCancel, onSave, saving, error }: ProfileDetailsModalProps) {
  const [name, setName] = useState(initialValues.name);
  const [categoryId, setCategoryId] = useState(initialValues.categoryId ?? '');
  const [subcategory, setSubcategory] = useState(initialValues.subcategory);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSave = () => {
    if (!name.trim()) {
      setNameError('Profile name is required.');
      return;
    }
    setNameError(null);
    onSave({ name: name.trim(), categoryId: categoryId || null, subcategory: subcategory.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] px-6" onClick={onCancel}>
      <div
        className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-xl text-afs-chrome-high mb-4">Profile Details</h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="pd-name">
              Profile Name
            </label>
            <input
              id="pd-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-body text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson transition-colors"
            />
            {nameError && <p className="font-body text-xs text-afs-crimson mt-1">{nameError}</p>}
          </div>
          <div>
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="pd-category">
              Category
            </label>
            <select
              id="pd-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-body text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson transition-colors"
            >
              <option value="">None</option>
              {AFS_PROFILE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="pd-subcategory">
              Subcategory
            </label>
            <input
              id="pd-subcategory"
              type="text"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="Optional"
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors"
            />
          </div>
          {error && <p className="font-body text-sm text-afs-crimson">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-sm font-semibold px-5 py-2.5 rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
