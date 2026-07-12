'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface TemplateCreateModalProps {
  hasCompany: boolean;
}

interface TemplateItemForm {
  profileType: string;
  material: string;
  lengthFt: string;
  quantity: string;
}

const EMPTY_ITEM: TemplateItemForm = { profileType: '', material: '', lengthFt: '', quantity: '1' };

export default function TemplateCreateModal({ hasCompany }: TemplateCreateModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCompanyShared, setIsCompanyShared] = useState(false);
  const [items, setItems] = useState<TemplateItemForm[]>([{ ...EMPTY_ITEM }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setName('');
    setDescription('');
    setIsCompanyShared(false);
    setItems([{ ...EMPTY_ITEM }]);
    setError(null);
    setLoading(false);
  }

  function updateItem(index: number, field: keyof TemplateItemForm, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addRow() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeRow(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }

    const parsedItems = items
      .filter((item) => item.profileType.trim() && item.lengthFt && item.quantity)
      .map((item) => ({
        profileType: item.profileType.trim(),
        material: item.material.trim() || undefined,
        lengthFt: parseFloat(item.lengthFt),
        quantity: parseInt(item.quantity, 10),
      }));

    if (parsedItems.length === 0) {
      setError('Add at least one item with a profile, length, and quantity.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, isCompanyShared, items: parsedItems }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Could not save template.');
        setLoading(false);
        return;
      }
      close();
      router.refresh();
    } catch {
      setError('Could not save template. Please try again.');
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="create-template-button"
        className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
      >
        Create Template
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--afs-bg-modal)] px-4 py-8 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[640px] bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl text-afs-chrome-high">Create Template</h2>
              <button type="button" onClick={close} className="text-afs-chrome-mid hover:text-afs-chrome-high" aria-label="Close">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="template-name" className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5">
                    Template Name
                  </label>
                  <input
                    id="template-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
                    placeholder="Standard Ranch Package"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="template-description" className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5">
                    Description
                  </label>
                  <input
                    id="template-description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
                    placeholder="Optional"
                  />
                </div>
              </div>

              {hasCompany && (
                <label className="flex items-center gap-2 font-body text-sm text-afs-chrome-mid">
                  <input
                    type="checkbox"
                    checked={isCompanyShared}
                    onChange={(e) => setIsCompanyShared(e.target.checked)}
                    className="accent-afs-crimson"
                  />
                  Share with my company team
                </label>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid">Items</span>
                  <button type="button" onClick={addRow} className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover">
                    + Add Item
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-2 items-center">
                      <input
                        type="text"
                        value={item.profileType}
                        onChange={(e) => updateItem(index, 'profileType', e.target.value)}
                        placeholder="Profile (e.g. Coping Cap)"
                        className="bg-afs-bg-overlay border border-afs-border rounded px-2.5 py-2 text-xs text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
                      />
                      <input
                        type="text"
                        value={item.material}
                        onChange={(e) => updateItem(index, 'material', e.target.value)}
                        placeholder="Material"
                        className="bg-afs-bg-overlay border border-afs-border rounded px-2.5 py-2 text-xs text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
                      />
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={item.lengthFt}
                        onChange={(e) => updateItem(index, 'lengthFt', e.target.value)}
                        placeholder="LF"
                        className="bg-afs-bg-overlay border border-afs-border rounded px-2.5 py-2 text-xs text-afs-chrome-high focus:border-afs-crimson outline-none font-data"
                      />
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        placeholder="Qty"
                        className="bg-afs-bg-overlay border border-afs-border rounded px-2.5 py-2 text-xs text-afs-chrome-high focus:border-afs-crimson outline-none font-data"
                      />
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        disabled={items.length === 1}
                        className="text-afs-chrome-dim hover:text-afs-crimson disabled:opacity-30 text-sm px-2"
                        aria-label="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="font-body text-xs text-afs-crimson">{error}</p>}

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={close}
                  className="border border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
